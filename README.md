# SEALS PlanetX SPHEREx

SEALS PlanetX SPHEREx is an interactive astronomy dashboard for exploring
SPHEREx observations from the NASA/IPAC Infrared Science Archive (IRSA).
Users can search by right ascension, declination, field of view, and optional
observation dates. Matching observations are displayed as generated images,
along with metadata such as detector and wavelength information.

## How it works

1. The frontend sends the search coordinates and date range to the backend.
2. The backend queries the SPHEREx collections through `astroquery`.
3. Observation metadata and IRSA FITS access URLs are returned to the frontend.
4. The backend downloads and renders FITS image data as PNG images when the
   frontend requests an observation.
5. The frontend displays the images in a carousel and shows observation
   metadata.

## Technologies

### Frontend

- **TypeScript**
- **React 19**
- **Next.js 16** with the App Router
- **CSS Modules**
- **npm** for package management

The frontend is in [`planetx-spherex/`](./planetx-spherex/).

### Backend

- **Python**
- **FastAPI** for the HTTP API
- **Uvicorn** for the development server
- **Astropy** for coordinates, FITS files, WCS, and image normalization
- **astroquery** for querying IRSA SPHEREx data
- **Matplotlib** for rendering FITS data into PNG images

The backend is in [`backend/main.py`](./backend/main.py). Python dependencies
are listed in [`requirements.txt`](./requirements.txt).

## Prerequisites

Install the following before setting up the project:

- Python 3.10 or newer
- Node.js 20 or newer
- npm
- Internet access for IRSA queries and FITS image downloads

## Local setup

### 1. Clone the repository

```powershell
git clone https://github.com/kprasad001/SEALS-PlanetX-SPHEREX.git
cd SEALS-PlanetX-SPHEREX
```

### 2. Set up the Python backend

Create and activate a virtual environment:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

Install the backend dependencies:

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Start the API server from the repository root:

```powershell
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at <http://localhost:8000>.

### 3. Set up the Next.js frontend

Open a second terminal and run:

```powershell
cd planetx-spherex
npm install
npm run dev
```

Open <http://localhost:3000> in a browser.

The frontend defaults to `http://localhost:8000` for the backend API. To use
a different backend URL, create `planetx-spherex/.env.local` with:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Restart the Next.js development server after changing environment variables.

## Useful commands

Run these commands from `planetx-spherex/`:

```powershell
npm run dev      # Start the development server
npm run lint     # Run ESLint
npm run build    # Create a production build
npm run start    # Serve the production build
```

## Backend API endpoints

- `GET /dashboard/map` — Search for SPHEREx observations.
- `GET /dashboard/image` — Download and render an observation as PNG.
- `GET /dashboard/detector` — Read detector metadata for an observation.

The API also exposes FastAPI documentation at <http://localhost:8000/docs>
when the backend is running.

## Troubleshooting

- Make sure the backend is running on port `8000` before searching in the
  frontend.
- If the browser reports a network or CORS error, verify that the frontend is
  running at `http://localhost:3000` and the backend is using port `8000`.
- FITS image rendering requires internet access and may take longer than a
  metadata search because the backend retrieves data from IRSA.
- If PowerShell blocks virtual-environment activation, run:

  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```