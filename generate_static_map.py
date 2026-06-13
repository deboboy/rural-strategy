import os
import sys
from pathlib import Path

import requests

DATA_URL = "https://services8.arcgis.com/rGGrs6HCnw87OFOT/arcgis/rest/services/RHC/FeatureServer/0/query"
STYLE = "mapbox/light-v11"
OUT = Path("/root/wa-rural-health-clinics-mapbox.png")


def main() -> int:
    token = os.environ.get("MAPBOX_ACCESS_TOKEN")
    if not token:
        print("MAPBOX_ACCESS_TOKEN is required", file=sys.stderr)
        return 2

    geo = requests.get(
        DATA_URL,
        params={"f": "geojson", "where": "1=1", "outFields": "*", "returnGeometry": "true"},
        timeout=30,
    ).json()
    features = geo.get("features", [])
    if not features:
        print("No features returned", file=sys.stderr)
        return 3

    color_by_accuracy = {"Close": "047857", "Approximate": "f59e0b", "Very Approximate": "dc2626"}
    pins = []
    for feature in features:
        lon, lat = feature["geometry"]["coordinates"]
        acc = feature["properties"].get("Accuracy") or "Close"
        color = color_by_accuracy.get(acc, "047857")
        pins.append(f"pin-s-1+{color}({lon:.5f},{lat:.5f})")

    overlay = ",".join(pins)
    center = "-120.7401,47.7511,6.15,0"
    size = "1280x880"
    url = f"https://api.mapbox.com/styles/v1/{STYLE}/static/{overlay}/{center}/{size}?access_token={token}"
    response = requests.get(url, timeout=90)

    if response.status_code != 200 or not response.content.startswith(b"\x89PNG"):
        print(f"Mapbox request failed: {response.status_code} {response.headers.get('content-type')}", file=sys.stderr)
        print(response.text[:500], file=sys.stderr)
        return 1

    OUT.write_bytes(response.content)
    print(f"wrote {OUT} ({len(features)} clinics)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
