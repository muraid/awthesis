----------------------------------------------------
     CODE FOR CONVERTING RAW DATA
----------------------------------------------------
import struct
import pandas as pd
import os

RAW_ROW_SIZE = 20
STRUCT_FORMAT = "<IBBBbbb bbb hhH B".replace(" ", "")

def parse_raw_file(filename):
    if not os.path.exists(filename):
        raise FileNotFoundError(f"File '{filename}' not found.")

    rows = []

    with open(filename, "rb") as f:
        data = f.read()

    num_rows = len(data) // RAW_ROW_SIZE

    offset = 0
    for _ in range(num_rows):
        chunk = data[offset:offset + RAW_ROW_SIZE]
        offset += RAW_ROW_SIZE

        parsed = struct.unpack(STRUCT_FORMAT, chunk)

        (
            timestamp,
            steps,
            hr,
            temp,
            ax,
            ay,
            az,
            mx,
            my,
            mz,
            gps_lat_raw,
            gps_lon_raw,
            battery,
            padding
        ) = parsed

        if timestamp == 0xFFFFFFFF:
            break

        rows.append({
            "timestamp": timestamp,
            "steps": steps,
            "hr": hr,
            "temp": temp,
            "accel_x": ax / 50.0,
            "accel_y": ay / 50.0,
            "accel_z": az / 50.0,
            "mag_x": mx,
            "mag_y": my,
            "mag_z": mz,
            "gps_lat": gps_lat_raw / 10000.0,
            "gps_lon": gps_lon_raw / 10000.0,
            "battery": battery / 10.0
        })

    return pd.DataFrame(rows)


if __name__ == "__main__":
    input_file = "collectedRawData.bin"
    output_file = "raw_converted.csv"

    df = parse_raw_file(input_file)
    df.to_csv(output_file, index=False)

    print(f"✔ Converting done! File saved as {output_file}")

----------------------------------------------------
     CODE FOR CONVERTING AGGREGATED DATA
----------------------------------------------------

