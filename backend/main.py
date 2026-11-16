from datetime import date, timedelta
from http.client import IncompleteRead
from io import BytesIO
import time
import re
from typing import Any
from urllib.error import HTTPError, URLError

import astropy.units as u
import matplotlib
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.time import Time
from astropy.visualization import simple_norm
from astropy.wcs import WCS
from astroquery.ipac.irsa import Irsa
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from numpy.ma import is_masked

matplotlib.use("Agg")
from matplotlib.figure import Figure  # thread-safe, unlike pyplot

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # your Next.js origin
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_RA = 305.693508808
DEFAULT_DEC = 42.4436872991
DEFAULT_FOV = 4


def _json_value(value: Any) -> Any:
    if value is None or is_masked(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    return value


_cache: dict[tuple, bytes] = {}
_detector_cache: dict[str, Any] = {}


def _read_detector(access_url: str) -> Any:
    if access_url in _detector_cache:
        return _detector_cache[access_url]

    detector_match = re.search(r"D([1-6])(?:_|\.|$)", access_url)
    if detector_match:
        detector = f"D{detector_match.group(1)}"
        _detector_cache[access_url] = detector
        return detector

    max_retries = 3
    for attempt in range(max_retries):
        try:
            with fits.open(access_url, memmap=False) as hdulist:
                detector = _json_value(hdulist[1].header.get("DETECTOR"))
                _detector_cache[access_url] = detector
                return detector
        except (TimeoutError, HTTPError, URLError, IncompleteRead, OSError):
            if attempt == max_retries - 1:
                raise
            time.sleep(10 * (attempt + 1))

    return None


def _render_png(
    access_url: str,
    ra: float,
    dec: float,
    size_pix: int,
    fov_val: float | None,
) -> bytes:
    key = (access_url, round(ra, 6), round(dec, 6), size_pix, fov_val)
    if key in _cache:
        return _cache[key]

    if fov_val is not None:
        fov = fov_val * u.deg
        cutout_size = f"{fov.to(u.deg).value:g}deg"
    else:
        cutout_size = f"{size_pix}pix"

    url = f"{access_url}?center={ra},{dec}d&size={cutout_size}"
    with fits.open(url) as hdul:
        hdu = hdul["IMAGE"]  # check hdul.info() if the name differs
        image = hdu.data
        wcs = WCS(hdu.header)

    fig = Figure(figsize=(7, 7))
    ax = fig.add_axes([0, 0, 1, 1], projection=wcs)  # fills figure, no margins
    ax.imshow(
        image,
        origin="lower",
        cmap="gray",
        interpolation="bicubic",
        norm=simple_norm(image, "asinh", percent=99),
    )
    ax.set_axis_off()

    buf = BytesIO()
    fig.savefig(buf, format="png", dpi=150)
    png = buf.getvalue()

    if len(_cache) >= 256:  # simple size cap
        _cache.pop(next(iter(_cache)))
    _cache[key] = png
    return png


@app.get("/dashboard/map")
def items(
    ra_deg: float = Query(DEFAULT_RA, ge=0, le=360),
    dec_deg: float = Query(DEFAULT_DEC, ge=-90, le=90),
    fov_val: float = Query(DEFAULT_FOV),
    observation_start: str | None = Query(None),
    observation_end: str | None = Query(None),
    radius_arcsec: float = Query(1, gt=0),
    max_rows: int = Query(20, ge=1, le=500),
) -> dict[str, Any]:

    try:
        coord = SkyCoord(ra_deg, dec_deg, unit="deg")
        search_radius = 1 * u.arcsec  # taking the search radius to be 1 arcsecond
        time_range = None
        if bool(observation_start) != bool(observation_end):
            raise ValueError("observation_start and observation_end must be provided together")
        if observation_start and observation_end:
            start_date = date.fromisoformat(observation_start)
            end_date = date.fromisoformat(observation_end)
            if end_date < start_date:
                raise ValueError("observation_end must be on or after observation_start")
            time_range = (
                Time(start_date.isoformat(), scale="utc"),
                Time(
                    (end_date + timedelta(days=1)).isoformat(),
                    scale="utc",
                ),
            )
        results = Irsa.query_sia(
            pos=(coord, radius_arcsec * u.arcsec),
            collection=["spherex_dr1", "spherex_qr3"],
            maxrec=100000,
            time=time_range,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid observation date range: {error}",
        ) from error
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"SPHEREx query failed: {error}") from error

    rows = [
        {column: _json_value(row[column]) for column in results.colnames}
        for row in results
    ]

    # No image rendering here; the frontend loads each from /dashboard/image
    return {"rows": rows, "count": len(rows), "total": len(results)}


@app.get("/dashboard/detector")
def detector(access_url: str) -> dict[str, Any]:
    if not access_url.startswith("https://irsa.ipac.caltech.edu/"):
        raise HTTPException(status_code=400, detail="Invalid access_url")

    try:
        return {"detector": _read_detector(access_url)}
    except (TimeoutError, HTTPError, URLError, IncompleteRead, OSError) as error:
        raise HTTPException(status_code=502, detail=f"Detector lookup failed: {error}") from error


@app.get("/dashboard/image")
def image(
    access_url: str,
    ra_deg: float = DEFAULT_RA,
    dec_deg: float = DEFAULT_DEC,
    size_pix: int = Query(500, ge=10, le=1000),
    fov_val: float | None = Query(None, gt=0, le=10),
) -> Response:
    if not access_url.startswith("https://irsa.ipac.caltech.edu/"):
        raise HTTPException(status_code=400, detail="Invalid access_url")  # avoid SSRF
    try:
        png = _render_png(access_url, ra_deg, dec_deg, size_pix, fov_val)
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"Image failed: {error}") from error
    return Response(png, media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})