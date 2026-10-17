"""Build an original, textured-free 3D Sparky GLB using only Python stdlib.

Coordinates: +Y up, +Z front. All anatomy is volumetric mesh geometry.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
import struct

OUT = Path(__file__).resolve().parent / "assets" / "sparky.glb"


def rgb(value):
    components = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in components]


PALETTE = {
    "Skin": "#82c852", "SkinShade": "#70b245", "Belly": "#eee9c8",
    "EyeWhite": "#fcfbef", "Iris": "#4c8138", "Pupil": "#151c1c",
    "Highlight": "#ffffff", "Mouth": "#294824", "GoldSpark": "#f8c743",
}
materials = []
for name, color in PALETTE.items():
    materials.append({
        "name": name,
        "pbrMetallicRoughness": {
            "baseColorFactor": rgb(color) + [1.0],
            "metallicFactor": 0.1 if name == "GoldSpark" else 0.0,
            "roughnessFactor": 0.45 if name == "GoldSpark" else 0.81,
        },
        **({"emissiveFactor": [0.2, 0.11, 0.01]} if name == "GoldSpark" else {}),
        "doubleSided": False,
    })
material_index = {material["name"]: index for index, material in enumerate(materials)}

binary = bytearray()
buffer_views = []
accessors = []
meshes = []
nodes = []


def append_buffer(payload, target):
    while len(binary) % 4:
        binary.append(0)
    offset = len(binary)
    binary.extend(payload)
    buffer_views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(payload), "target": target})
    return len(buffer_views) - 1


def accessor(values, kind, component, target, minimum=None, maximum=None):
    stride = {"SCALAR": 1, "VEC3": 3}[kind]
    fmt = "f" if component == 5126 else "H"
    payload = struct.pack("<" + fmt * len(values), *values)
    view = append_buffer(payload, target)
    result = {"bufferView": view, "componentType": component, "count": len(values) // stride, "type": kind}
    if minimum is not None:
        result["min"] = minimum
        result["max"] = maximum
    accessors.append(result)
    return len(accessors) - 1


def sphere_geometry(rings=18, slices=28):
    positions, normals, indices = [], [], []
    for row in range(rings + 1):
        theta = math.pi * row / rings
        for col in range(slices + 1):
            phi = 2 * math.pi * col / slices
            xyz = (math.sin(theta) * math.cos(phi), math.cos(theta), math.sin(theta) * math.sin(phi))
            positions.extend(xyz)
            normals.extend(xyz)
    for row in range(rings):
        for col in range(slices):
            a = row * (slices + 1) + col
            b = a + 1
            c = a + slices + 1
            d = c + 1
            indices.extend((a, b, c, b, d, c))
    return positions, normals, indices


def geometry_accessors(positions, normals, indices):
    xyz = list(zip(*[iter(positions)] * 3))
    p = accessor(positions, "VEC3", 5126, 34962,
                 [min(item[axis] for item in xyz) for axis in range(3)],
                 [max(item[axis] for item in xyz) for axis in range(3)])
    n = accessor(normals, "VEC3", 5126, 34962)
    i = accessor(indices, "SCALAR", 5123, 34963)
    return p, n, i


sphere_accessors = geometry_accessors(*sphere_geometry())
for material in materials:
    meshes.append({"name": "UnitSphere_" + material["name"], "primitives": [{
        "attributes": {"POSITION": sphere_accessors[0], "NORMAL": sphere_accessors[1]},
        "indices": sphere_accessors[2], "material": material_index[material["name"]], "mode": 4,
    }]})
mesh_for = {name: index for index, name in enumerate(PALETTE)}


def star_geometry():
    outline = []
    for k in range(8):
        angle = math.pi / 2 - k * math.pi / 4
        radius = 1.0 if k % 2 == 0 else 0.29
        outline.append((math.cos(angle) * radius, math.sin(angle) * radius))
    positions, normals, indices = [], [], []

    def triangle(points, normal):
        start = len(positions) // 3
        for point in points:
            positions.extend(point)
            normals.extend(normal)
        indices.extend((start, start + 1, start + 2))

    for k in range(8):
        x1, y1 = outline[k]
        x2, y2 = outline[(k + 1) % 8]
        triangle(((0, 0, .11), (x2, y2, .11), (x1, y1, .11)), (0, 0, 1))
        triangle(((0, 0, -.11), (x1, y1, -.11), (x2, y2, -.11)), (0, 0, -1))
        side = (y1 - y2, x2 - x1, 0)
        length = math.hypot(side[0], side[1])
        normal = (side[0] / length, side[1] / length, 0)
        triangle(((x1, y1, .11), (x2, y2, .11), (x1, y1, -.11)), normal)
        triangle(((x2, y2, .11), (x2, y2, -.11), (x1, y1, -.11)), normal)
    return positions, normals, indices


star_accessors = geometry_accessors(*star_geometry())
meshes.append({"name": "FourPointSpark", "primitives": [{
    "attributes": {"POSITION": star_accessors[0], "NORMAL": star_accessors[1]},
    "indices": star_accessors[2], "material": material_index["GoldSpark"], "mode": 4,
}]})
star_mesh = len(meshes) - 1


def node(name, parent=None, material=None, position=None, scale=None, rotation=None, mesh=None):
    item = {"name": name}
    if material is not None:
        item["mesh"] = mesh_for[material]
    if mesh is not None:
        item["mesh"] = mesh
    if position is not None:
        item["translation"] = list(position)
    if scale is not None:
        item["scale"] = list(scale)
    if rotation is not None:
        item["rotation"] = list(rotation)
    nodes.append(item)
    index = len(nodes) - 1
    if parent is not None:
        nodes[parent].setdefault("children", []).append(index)
    return index


def zrot(angle):
    return (0, 0, math.sin(angle / 2), math.cos(angle / 2))


root = node("SparkyRoot")
breath = node("BodyBreath", root)
node("PearBody", breath, "Skin", (0, 1.16, 0), (.64, .85, .51))
node("CreamBelly", breath, "Belly", (0, 1.15, .435), (.49, .67, .17))
node("BackContour", breath, "SkinShade", (0, .94, -.31), (.55, .48, .24))

head = node("HeadRig", root, position=(0, 2.17, .02))
node("HeadVolume", head, "Skin", (0, 0, 0), (.83, .61, .62))
node("LowerMuzzle", head, "Skin", (0, -.24, .37), (.78, .34, .39))
node("CreamChin", head, "Belly", (0, -.42, .43), (.67, .19, .29))
for side, label in ((-1, "L"), (1, "R")):
    x = side * .53
    node(f"EyeMound_{label}", head, "Skin", (x, .40, .25), (.30, .32, .30))
    eye = node(f"Eye_{label}_Rig", head, position=(x, .40, .47))
    node(f"EyeWhite_{label}", eye, "EyeWhite", (0, 0, 0), (.25, .265, .16))
    node(f"Iris_{label}", eye, "Iris", (side * -.025, -.018, .145), (.17, .19, .075))
    node(f"Pupil_{label}", eye, "Pupil", (side * -.026, -.02, .205), (.115, .14, .043))
    node(f"EyeGlint_{label}", eye, "Highlight", (side * -.068, .055, .235), (.037, .038, .025))
    node(f"Nostril_{label}", head, "Mouth", (side * .14, -.075, .632), (.032, .017, .012))
    node(f"Cheek_{label}", head, "SkinShade", (side * .60, -.24, .41), (.08, .05, .025))

for i in range(10):
    x = -.46 + .92 * i / 9
    y = -.25 + .14 * (abs(x) / .46) ** 2
    node(f"SmileCurve_{i:02d}", head, "Mouth", (x, y, .725 - .06 * (abs(x) / .46)), (.063, .021, .018))

node("ForeheadSpark", head, mesh=star_mesh, position=(0, .18, .625), scale=(.155, .155, .155))

for side, label in ((-1, "L"), (1, "R")):
    arm = node(f"Arm_{label}_Rig", root, position=(side * .55, 1.65, .01))
    node(f"UpperArm_{label}", arm, "Skin", (side * .15, -.27, .02), (.19, .48, .19), zrot(side * .43))
    node(f"Palm_{label}", arm, "Skin", (side * .35, -.66, .09), (.18, .16, .14))
    for finger in range(3):
        offset = finger - 1
        node(f"Finger_{label}_{finger + 1}", arm, "Skin",
             (side * .35 + offset * .135, -.81 - (.025 if finger == 1 else 0), .11 + (1 - abs(offset)) * .03),
             (.075, .16, .085), zrot(offset * .22))
    node(f"Thigh_{label}", root, "Skin", (side * .34, .59, -.025), (.255, .48, .26), zrot(-side * .09))
    node(f"Foot_{label}", root, "Skin", (side * .39, .17, .22), (.30, .15, .37))
    for toe in range(3):
        offset = toe - 1
        node(f"Toe_{label}_{toe + 1}", root, "Skin",
             (side * .39 + offset * .20, .105, .52 - abs(offset) * .06), (.12, .11, .23))

gltf = {
    "asset": {"version": "2.0", "generator": "Sparky stdlib mesh builder v1"},
    "scene": 0, "scenes": [{"name": "Sparky", "nodes": [root]}],
    "nodes": nodes, "meshes": meshes, "materials": materials,
    "buffers": [{"byteLength": len(binary)}], "bufferViews": buffer_views,
    "accessors": accessors,
    "extras": {"frontAxis": "+Z", "rigNodes": ["BodyBreath", "HeadRig", "Eye_L_Rig", "Eye_R_Rig", "Arm_R_Rig", "ForeheadSpark"],
               "animationDriver": "JavaScript, none embedded in GLB"},
}
json_chunk = json.dumps(gltf, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
json_chunk += b" " * ((-len(json_chunk)) % 4)
bin_chunk = bytes(binary) + b"\x00" * ((-len(binary)) % 4)
total = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_bytes(struct.pack("<4sII", b"glTF", 2, total) +
                struct.pack("<I4s", len(json_chunk), b"JSON") + json_chunk +
                struct.pack("<I4s", len(bin_chunk), b"BIN\x00") + bin_chunk)
print(f"Built {OUT}: {OUT.stat().st_size} bytes, {len(nodes)} nodes, {len(meshes)} meshes")
