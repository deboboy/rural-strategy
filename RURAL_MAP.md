# Washington Rural Health Clinics - Mapbox Results

Generated from the Washington State Geospatial Open Data Portal / DOH Rural Health Clinics ArcGIS layer.

## Contents

- `rural-health-clinics-wa-map.html`: interactive Mapbox GL map with clustering and popups.
- `wa-rural-health-clinics-mapbox.png`: static Mapbox PNG overview map.
- `generate_static_map.py`: reproducible script for regenerating the static PNG from the public ArcGIS layer.

## Data summary

- 114 rural health clinic points
- 38 Washington counties
- Source: WA DOH RHC FeatureServer layer used by the Health Professional Shortage Areas application

## Usage

Open the HTML with a Mapbox token:

```bash
python3 -m http.server 8000 --directory .
```

Then open:

```text
http://localhost:8000/rural-health-clinics-wa-map.html?access_token=YOUR_MAPBOX_TOKEN
```

The Mapbox token is intentionally not committed to this repository.
