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
    "Skin": "#70ad47", "SkinShade": "#5f983e", "Belly": "#eae8cc",
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
    fmt = {5126: "f", 5123: "H", 5125: "I"}[component]
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
    i = accessor(indices, "SCALAR", 5125 if max(indices) > 65535 else 5123, 34963)
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


def belly_patch_geometry():
    """A curved surface patch follows the torso instead of floating as a slab."""
    positions, normals, indices = [], [], []
    rows, columns = 20, 24
    for row in range(rows + 1):
        v = -1 + 2 * row / rows
        y = 1.17 + .68 * v
        width = .425 * math.sqrt(max(0, 1 - v * v))
        for col in range(columns + 1):
            x = width * (-1 + 2 * col / columns)
            z = .51 * math.sqrt(max(.001, 1 - (x / .57) ** 2 - ((y - 1.16) / .85) ** 2)) + .017
            positions.extend((x, y, z))
            n = (x / .57 ** 2, (y - 1.16) / .85 ** 2, (z - .017) / .51 ** 2)
            length = math.sqrt(sum(component * component for component in n))
            normals.extend(component / length for component in n)
    for row in range(rows):
        for col in range(columns):
            a = row * (columns + 1) + col
            b, c, d = a + 1, a + columns + 1, a + columns + 2
            indices.extend((a, b, c, b, d, c))
    return positions, normals, indices


belly_accessors = geometry_accessors(*belly_patch_geometry())
meshes.append({"name": "CurvedBellyPatch", "primitives": [{
    "attributes": {"POSITION": belly_accessors[0], "NORMAL": belly_accessors[1]},
    "indices": belly_accessors[2], "material": material_index["Belly"], "mode": 4,
}]})
belly_mesh = len(meshes) - 1


def head_field(x, y, z):
    """Smoothly blend head, snout, cheeks and eyelid mounds into one volume."""
    def ellipsoid(cx, cy, cz, rx, ry, rz):
        return (math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2) - 1) * min(rx, ry, rz)

    def smooth_union(a, b, blend):
        h = max(blend - abs(a - b), 0) / blend
        return min(a, b) - h * h * blend * .25

    result = ellipsoid(0, 0, 0, .83, .56, .53)
    result = smooth_union(result, ellipsoid(0, -.23, .27, .88, .35, .38), .20)
    result = smooth_union(result, ellipsoid(0, -.43, .10, .86, .44, .42), .17)
    for side in (-1, 1):
        result = smooth_union(result, ellipsoid(side * .59, .39, .19, .34, .37, .30), .16)
        result = smooth_union(result, ellipsoid(side * .67, -.27, .17, .27, .25, .32), .13)
    return result


def head_front_z(x, y):
    lo, hi = 0.0, 1.0
    assert head_field(x, y, lo) < 0, (x, y)
    for _ in range(26):
        mid = (lo + hi) / 2
        if head_field(x, y, mid) < 0:
            lo = mid
        else:
            hi = mid
    return hi


def organic_volume_geometry(field, origin, counts, step):
    """Build connected volumetric geometry with smooth normals."""
    x0, y0, z0 = origin
    nx, ny, nz = counts
    coords = []
    fields = []
    for k in range(nz + 1):
        z = z0 + k * step
        for j in range(ny + 1):
            y = y0 + j * step
            for i in range(nx + 1):
                x = x0 + i * step
                coords.append((x, y, z))
                fields.append(field(x, y, z))

    def grid(i, j, k):
        return (k * (ny + 1) + j) * (nx + 1) + i

    tetrahedra = ((0, 5, 1, 6), (0, 1, 2, 6), (0, 2, 3, 6),
                  (0, 3, 7, 6), (0, 7, 4, 6), (0, 4, 5, 6))
    positions, normals, indices = [], [], []

    def gradient(point):
        x, y, z = point
        e = .002
        vector = (field(x + e, y, z) - field(x - e, y, z),
                  field(x, y + e, z) - field(x, y - e, z),
                  field(x, y, z + e) - field(x, y, z - e))
        length = math.sqrt(sum(v * v for v in vector))
        return tuple(v / length for v in vector)

    def interpolate(a, b):
        t = fields[a] / (fields[a] - fields[b])
        return tuple(coords[a][axis] + t * (coords[b][axis] - coords[a][axis]) for axis in range(3))

    def triangle(points):
        center = tuple(sum(point[axis] for point in points) / 3 for axis in range(3))
        a, b, c = points
        u = tuple(b[axis] - a[axis] for axis in range(3))
        v = tuple(c[axis] - a[axis] for axis in range(3))
        cross = (u[1] * v[2] - u[2] * v[1],
                 u[2] * v[0] - u[0] * v[2],
                 u[0] * v[1] - u[1] * v[0])
        outward = gradient(center)
        if sum(cross[axis] * outward[axis] for axis in range(3)) < 0:
            points = (a, c, b)
        for point in points:
            indices.append(len(positions) // 3)
            positions.extend(point)
            normals.extend(gradient(point))

    for k in range(nz):
        for j in range(ny):
            for i in range(nx):
                cube = (grid(i, j, k), grid(i + 1, j, k),
                        grid(i + 1, j + 1, k), grid(i, j + 1, k),
                        grid(i, j, k + 1), grid(i + 1, j, k + 1),
                        grid(i + 1, j + 1, k + 1), grid(i, j + 1, k + 1))
                for tetra in tetrahedra:
                    inside = [cube[t] for t in tetra if fields[cube[t]] < 0]
                    outside = [cube[t] for t in tetra if fields[cube[t]] >= 0]
                    if len(inside) == 1:
                        triangle(tuple(interpolate(inside[0], out) for out in outside))
                    elif len(inside) == 3:
                        triangle(tuple(interpolate(inn, outside[0]) for inn in inside))
                    elif len(inside) == 2:
                        a, b = inside
                        c, d = outside
                        ac, ad, bc, bd = interpolate(a, c), interpolate(a, d), interpolate(b, c), interpolate(b, d)
                        triangle((ac, ad, bc))
                        triangle((ad, bd, bc))
    return positions, normals, indices


head_accessors = geometry_accessors(*organic_volume_geometry(head_field, (-1.12, -.79, -.68), (50, 36, 38), .045))
meshes.append({"name": "OrganicFrogHead", "primitives": [{
    "attributes": {"POSITION": head_accessors[0], "NORMAL": head_accessors[1]},
    "indices": head_accessors[2], "material": material_index["Skin"], "mode": 4,
}]})
head_mesh = len(meshes) - 1


def rounded_union(a, b, blend):
    h = max(blend - abs(a - b), 0) / blend
    return min(a, b) - h * h * blend * .25


def ellipsoid_field(x, y, z, center, size):
    return (math.sqrt(sum(((p - c) / radius) ** 2 for p, c, radius in zip((x, y, z), center, size))) - 1) * min(size)


def hand_field(x, y, z):
    result = ellipsoid_field(x, y, z, (0, 0, 0), (.18, .17, .15))
    for finger in (-1, 0, 1):
        result = rounded_union(result, ellipsoid_field(x, y, z,
            (finger * .17, -.25 - (.025 if finger == 0 else 0), .035), (.063, .18, .078)), .04)
    return result


hand_accessors = geometry_accessors(*organic_volume_geometry(hand_field, (-.38, -.50, -.25), (38, 37, 27), .02))
meshes.append({"name": "ConnectedThreeFingerHand", "primitives": [{
    "attributes": {"POSITION": hand_accessors[0], "NORMAL": hand_accessors[1]},
    "indices": hand_accessors[2], "material": material_index["Skin"], "mode": 4,
}]})
hand_mesh = len(meshes) - 1


def foot_field(x, y, z):
    result = ellipsoid_field(x, y, z, (0, 0, 0), (.28, .13, .35))
    for toe in (-1, 0, 1):
        result = rounded_union(result, ellipsoid_field(x, y, z,
            (toe * .22, -.045, .31 - abs(toe) * .04), (.10, .09, .23)), .045)
    return result


foot_accessors = geometry_accessors(*organic_volume_geometry(foot_field, (-.49, -.23, -.39), (35, 18, 36), .028))
meshes.append({"name": "ConnectedThreeToeFoot", "primitives": [{
    "attributes": {"POSITION": foot_accessors[0], "NORMAL": foot_accessors[1]},
    "indices": foot_accessors[2], "material": material_index["Skin"], "mode": 4,
}]})
foot_mesh = len(meshes) - 1


def chin_patch_geometry():
    """Cream-colored lower face follows the connected head surface."""
    positions, normals, indices = [], [], []
    rows, columns = 24, 30
    for row in range(rows + 1):
        v = row / rows
        half_width = .73 + .10 * math.sin(math.pi * v) - .22 * v * v
        for col in range(columns + 1):
            u = -1 + 2 * col / columns
            x = half_width * u
            y = -.305 - .455 * v + u * u * (.10 * (1 - v) + .06 * v)
            z = head_front_z(x, y) + .014
            positions.extend((x, y, z))
            e = .002
            normal = (head_field(x + e, y, z) - head_field(x - e, y, z),
                      head_field(x, y + e, z) - head_field(x, y - e, z),
                      head_field(x, y, z + e) - head_field(x, y, z - e))
            length = math.sqrt(sum(component * component for component in normal))
            normals.extend(component / length for component in normal)
    for row in range(rows):
        for col in range(columns):
            a = row * (columns + 1) + col
            b, c, d = a + 1, a + columns + 1, a + columns + 2
            indices.extend((a, c, b, b, c, d))
    return positions, normals, indices


chin_accessors = geometry_accessors(*chin_patch_geometry())
meshes.append({"name": "CurvedCreamJaw", "primitives": [{
    "attributes": {"POSITION": chin_accessors[0], "NORMAL": chin_accessors[1]},
    "indices": chin_accessors[2], "material": material_index["Belly"], "mode": 4,
}]})
chin_mesh = len(meshes) - 1


def smile_line_geometry():
    """One continuous dark ribbon on the curved green muzzle."""
    positions, normals, indices = [], [], []
    segments = 48
    for i in range(segments + 1):
        x = -.55 + 1.10 * i / segments
        y = -.29 + .10 * (abs(x) / .55) ** 2
        for dy in (.008, -.008):
            yy = y + dy
            z = head_front_z(x, yy) + .024
            positions.extend((x, yy, z))
            normals.extend((0, 0, 1))
    for i in range(segments):
        a = 2 * i
        indices.extend((a, a + 1, a + 2, a + 1, a + 3, a + 2))
    return positions, normals, indices


smile_accessors = geometry_accessors(*smile_line_geometry())
meshes.append({"name": "ContinuousSmile", "primitives": [{
    "attributes": {"POSITION": smile_accessors[0], "NORMAL": smile_accessors[1]},
    "indices": smile_accessors[2], "material": material_index["Mouth"], "mode": 4,
}]})
smile_mesh = len(meshes) - 1


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
node("PearBody", breath, "Skin", (0, 1.16, 0), (.57, .85, .51))
node("CreamBelly", breath, mesh=belly_mesh)

head = node("HeadRig", root, position=(0, 2.17, .02))
node("HeadVolume", head, mesh=head_mesh)
node("CreamChin", head, mesh=chin_mesh)
for side, label in ((-1, "L"), (1, "R")):
    x = side * .59
    eye = node(f"Eye_{label}_Rig", head, position=(x, .39, .47))
    node(f"EyeWhite_{label}", eye, "EyeWhite", (0, 0, 0), (.265, .335, .095))
    node(f"Iris_{label}", eye, "Iris", (side * -.025, -.018, .09), (.19, .245, .045))
    node(f"Pupil_{label}", eye, "Pupil", (side * -.026, -.02, .126), (.14, .185, .026))
    node(f"EyeGlint_{label}", eye, "Highlight", (side * -.068, .055, .149), (.035, .038, .015))
    nostril_x, nostril_y = side * .14, -.075
    node(f"Nostril_{label}", head, "Mouth", (nostril_x, nostril_y, head_front_z(nostril_x, nostril_y) + .01), (.027, .016, .011))

node("SmileLine", head, mesh=smile_mesh)

node("ForeheadSpark", head, mesh=star_mesh, position=(0, .18, .625), scale=(.155, .155, .155))

for side, label in ((-1, "L"), (1, "R")):
    arm = node(f"Arm_{label}_Rig", root, position=(side * .54, 1.72, .01))
    node(f"UpperArm_{label}", arm, "Skin", (side * .30, -.32, .02), (.16, .50, .17), zrot(side * .54))
    node(f"HandVolume_{label}", arm, position=(side * .62, -.73, .09), mesh=hand_mesh)
    node(f"Thigh_{label}", root, "Skin", (side * .30, .56, -.025), (.21, .51, .24), zrot(-side * .09))
    node(f"FootVolume_{label}", root, position=(side * .35, .17, .22), mesh=foot_mesh)

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
