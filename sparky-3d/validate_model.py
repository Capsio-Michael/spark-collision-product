"""Sanity-check the deliverable GLB and the body parts needed for a full turn."""
import json
from pathlib import Path
import struct

path = Path(__file__).resolve().parent / "assets" / "sparky.glb"
blob = path.read_bytes()
assert len(blob) >= 28
magic, version, length = struct.unpack_from("<4sII", blob)
assert (magic, version, length) == (b"glTF", 2, len(blob))
json_size, json_type = struct.unpack_from("<I4s", blob, 12)
assert json_type == b"JSON" and json_size % 4 == 0
data = json.loads(blob[20:20 + json_size])
bin_start = 20 + json_size
bin_size, bin_type = struct.unpack_from("<I4s", blob, bin_start)
assert bin_type == b"BIN\x00" and bin_size % 4 == 0
assert bin_start + 8 + bin_size == len(blob)
assert data["asset"]["version"] == "2.0"
assert len(data["buffers"]) == 1 and data["buffers"][0]["byteLength"] <= bin_size
assert all("uri" not in buffer for buffer in data["buffers"])
for view in data["bufferViews"]:
    assert view["byteOffset"] + view["byteLength"] <= bin_size
for accessor in data["accessors"]:
    view = data["bufferViews"][accessor["bufferView"]]
    component_bytes = {5123: 2, 5126: 4}[accessor["componentType"]]
    components = {"SCALAR": 1, "VEC3": 3}[accessor["type"]]
    assert accessor["count"] * component_bytes * components <= view["byteLength"]

nodes = {item["name"]: item for item in data["nodes"]}
for name in (
    "SparkyRoot", "BodyBreath", "HeadRig", "Eye_L_Rig", "Eye_R_Rig",
    "Arm_R_Rig", "ForeheadSpark", "PearBody", "BackContour",
    "EyeWhite_L", "EyeWhite_R", "Foot_L", "Foot_R",
):
    assert name in nodes, name
for side in "LR":
    for finger in range(1, 4):
        assert f"Finger_{side}_{finger}" in nodes
        assert f"Toe_{side}_{finger}" in nodes
material_names = {item["name"] for item in data["materials"]}
assert {"Skin", "SkinShade", "Belly", "GoldSpark"} <= material_names
assert len(data["meshes"]) >= 10
assert len(data["nodes"]) >= 50
assert not data.get("animations"), "Animation is driven by the viewer and documented as such"
print(f"PASS {path.name}: {len(blob)} bytes, {len(nodes)} named nodes, {len(data['meshes'])} meshes, embedded binary only")
