"""组件类型校验 + PRESET_BLUEPRINTS 预设蓝图。"""

from .sysutil import c

VALID_COMPONENT_TYPES = {
    'Transform', 'Velocity', 'Acceleration', 'Mass', 'Shape', 'Overlap',
    'Timer', 'Resource', 'Flag', 'Tag', 'Relation', 'Visibility',
    'RawInput', 'Action', 'Controllable', 'State', 'SpawnRequest',
    'DestroyRequest', 'Sprite', 'Color', 'Frame', 'Sound', 'Camera',
    'Text', 'RandomSeed', 'SpatialIndex', 'Grounded', 'Bounds',
}

def _validate_blueprint(bp: dict) -> list[str]:
    """Validate canonical manifest { name, capabilities:[id], entities:{id:{Comp:{...}}} }; return warnings."""
    warnings = []
    if not isinstance(bp.get('name'), str):
        warnings.append('Missing or invalid "name" field')
    caps = bp.get('capabilities')
    if caps is not None and (not isinstance(caps, list) or not all(isinstance(c, str) for c in caps)):
        warnings.append('"capabilities" must be a list of capability id strings')
    entities = bp.get('entities')
    if not isinstance(entities, dict):
        warnings.append('"entities" must be an object { entityId: { ComponentType: {...} } }')
        return warnings
    if len(entities) == 0:
        warnings.append('Blueprint has zero entities')
    has_camera = False
    for eid, comps in entities.items():
        if not isinstance(comps, dict) or len(comps) == 0:
            warnings.append(f'Entity "{eid}": components must be a non-empty object')
            continue
        for ctype in comps:
            if ctype not in VALID_COMPONENT_TYPES:
                warnings.append(f'Entity "{eid}": unknown component type "{ctype}"')
            if ctype == 'Camera':
                has_camera = True
    if not has_camera:
        warnings.append('No Camera entity found — rendering may fail')
    return warnings

# 物理/球类预设共用的能力 id 集（相机居中静态 → 世界↔屏幕 1:1，实体可见）。
_PHYSICS_CAPS = ['a1-transform', 'b1-velocity', 'b2-acceleration', 'c1-shape', 'l2-color',
                 'd1-overlap-detect', 't1-accel-apply', 't1-motion-apply', 't2-collision-resolve', 't2-bounds-clamp']
_PONG_CAPS = ['a1-transform', 'b1-velocity', 'c1-shape', 'l2-color', 'd1-overlap-detect',
              't1-motion-apply', 't2-collision-resolve', 't2-bounds-clamp']
_CAM = {'Camera': {'zoom': 1, 'offsetX': 320, 'offsetY': 200, 'rotation': 0, 'viewportW': 640, 'viewportH': 400}}

# 预设 = 规范 manifest（entities 为对象、capabilities 为能力 id 列表）→ parseManifest 可直接加载进透视器。
PRESET_BLUEPRINTS = {
    'platformer': {
        'name': 'Simple Platformer',
        'description': 'Gravity + platforms',
        'capabilities': _PHYSICS_CAPS,
        'entities': {
            'camera': _CAM,
            'player': {
                'Transform': {'x': 120, 'y': 100, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                'Velocity': {'vx': 0, 'vy': 0, 'angular': 0},
                'Acceleration': {'ax': 0, 'ay': 0.5},
                'Shape': {'kind': 'box', 'width': 20, 'height': 20},
                'Mass': {'value': 1},
                'Color': {'tint': 0x38bdf8, 'alpha': 1},
                'Controllable': {'playerId': 'p1', 'speed': 3},
                'Bounds': {'minX': 0, 'minY': 0, 'maxX': 640, 'maxY': 400},
            },
            'ground': {'Transform': {'x': 320, 'y': 385, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                       'Shape': {'kind': 'box', 'width': 640, 'height': 30}, 'Mass': {'value': 0}, 'Color': {'tint': 0x334155, 'alpha': 1}},
            'platform1': {'Transform': {'x': 200, 'y': 300, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                          'Shape': {'kind': 'box', 'width': 100, 'height': 12}, 'Mass': {'value': 0}, 'Color': {'tint': 0x475569, 'alpha': 1}},
            'platform2': {'Transform': {'x': 420, 'y': 240, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                          'Shape': {'kind': 'box', 'width': 100, 'height': 12}, 'Mass': {'value': 0}, 'Color': {'tint': 0x475569, 'alpha': 1}},
            'platform3': {'Transform': {'x': 150, 'y': 180, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                          'Shape': {'kind': 'box', 'width': 80, 'height': 12}, 'Mass': {'value': 0}, 'Color': {'tint': 0x475569, 'alpha': 1}},
        },
    },
    'pong': {
        'name': 'Pong',
        'description': 'Two-player pong',
        'capabilities': _PONG_CAPS,
        'entities': {
            'camera': _CAM,
            'ball': {'Transform': {'x': 320, 'y': 200, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                     'Velocity': {'vx': 3, 'vy': 2, 'angular': 0}, 'Shape': {'kind': 'circle', 'radius': 8},
                     'Mass': {'value': 1}, 'Color': {'tint': 0xfbbf24, 'alpha': 1}, 'Bounds': {'minX': 0, 'minY': 0, 'maxX': 640, 'maxY': 400}},
            'paddle-left': {'Transform': {'x': 30, 'y': 200, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                            'Velocity': {'vx': 0, 'vy': 0, 'angular': 0}, 'Shape': {'kind': 'box', 'width': 12, 'height': 60},
                            'Mass': {'value': 0}, 'Color': {'tint': 0x38bdf8, 'alpha': 1}, 'Controllable': {'playerId': 'p1', 'speed': 4},
                            'Bounds': {'minX': 0, 'minY': 0, 'maxX': 640, 'maxY': 400}},
            'paddle-right': {'Transform': {'x': 610, 'y': 200, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                             'Velocity': {'vx': 0, 'vy': 0, 'angular': 0}, 'Shape': {'kind': 'box', 'width': 12, 'height': 60},
                             'Mass': {'value': 0}, 'Color': {'tint': 0xe8618c, 'alpha': 1}, 'Controllable': {'playerId': 'p2', 'speed': 4},
                             'Bounds': {'minX': 0, 'minY': 0, 'maxX': 640, 'maxY': 400}},
            'wall-top': {'Transform': {'x': 320, 'y': 10, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                         'Shape': {'kind': 'box', 'width': 640, 'height': 10}, 'Mass': {'value': 0}, 'Color': {'tint': 0x334155, 'alpha': 1}},
            'wall-bottom': {'Transform': {'x': 320, 'y': 390, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                            'Shape': {'kind': 'box', 'width': 640, 'height': 10}, 'Mass': {'value': 0}, 'Color': {'tint': 0x334155, 'alpha': 1}},
        },
    },
}
