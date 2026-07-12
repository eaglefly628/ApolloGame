"""低模模板库（TEMPLATE_LIBRARY）+ 能力族/关键词映射。"""
import json

from .blueprints import PRESET_BLUEPRINTS, _CAM

# ══ 低模模板库（REQ-STUDIO 低模 ①）══════════════════════════════════════════════
# 内置「能跑模板 manifest」库（按题材键）——弱模型不再从零作曲，而是从最近的可运行基线做增量修改。
# **每个模板都过 manifest-check 全绿**（守护：scripts/studio-lowmodel-smoke.py 逐个校验）。
# 收编自现有 PRESET（platform-jump/pong）+ 系统词最小样例（bounce）+ 新增题材（collect/dice/cards）。
_TEXT = {'fontSize': 16, 'fontFamily': 'sans-serif', 'anchor': 'center', 'lineSpacing': 1.2}

TEMPLATE_LIBRARY = {
    'bounce': {
        'key': 'bounce', 'name': '弹跳小球', 'description': '一个小球在重力下下落，撞到地面就反弹',
        'capabilities': ['a1-transform', 'b1-velocity', 'b2-acceleration', 'c1-shape', 'l2-color',
                         'l5-camera', 'b3-mass', 'd1-overlap-detect', 't1-accel-apply', 't1-motion-apply',
                         't2-collision-resolve', 't2-bounds-clamp'],
        'entities': {
            'camera': _CAM,
            'ball': {'Transform': {'x': 320, 'y': 60, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                     'Velocity': {'vx': 2, 'vy': 0, 'angular': 0}, 'Acceleration': {'ax': 0, 'ay': 0.5},
                     'Shape': {'kind': 'circle', 'radius': 12}, 'Color': {'tint': 0x4ae0d0, 'alpha': 1},
                     'Mass': {'value': 1}, 'Bounds': {'minX': 0, 'minY': 0, 'maxX': 640, 'maxY': 400}},
            'ground': {'Transform': {'x': 320, 'y': 380, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                       'Shape': {'kind': 'box', 'width': 640, 'height': 40}, 'Color': {'tint': 0x36363e, 'alpha': 1},
                       'Mass': {'value': 0}},
        },
    },
    'platform-jump': {
        'key': 'platform-jump', 'name': '平台跳跃', 'description': '带重力的横版平台跳跃：玩家在若干平台间移动',
        'capabilities': list(PRESET_BLUEPRINTS['platformer']['capabilities']),
        'entities': json.loads(json.dumps(PRESET_BLUEPRINTS['platformer']['entities'])),
    },
    'pong': {
        'key': 'pong', 'name': '弹球对战', 'description': '两名玩家用球拍接弹球（Pong）',
        'capabilities': list(PRESET_BLUEPRINTS['pong']['capabilities']),
        'entities': json.loads(json.dumps(PRESET_BLUEPRINTS['pong']['entities'])),
    },
    'collect': {
        'key': 'collect', 'name': '收集金币', 'description': '俯视角玩家在场地里移动，碰到金币把它收集掉',
        'capabilities': ['a1-transform', 'b1-velocity', 'c1-shape', 'l2-color', 'l5-camera', 'g1-tag',
                         'd1-overlap-detect', 't2-trigger-zone', 't2-bounds-clamp', 't1-motion-apply',
                         'k2-destroy', 'f1-resource'],
        'entities': {
            'camera': _CAM,
            'player': {'Transform': {'x': 320, 'y': 200, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                       'Velocity': {'vx': 0, 'vy': 0, 'angular': 0}, 'Shape': {'kind': 'box', 'width': 22, 'height': 22},
                       'Color': {'tint': 0x38bdf8, 'alpha': 1}, 'Controllable': {'playerId': 'p1', 'speed': 3},
                       'Tag': {'flags': 1}, 'Bounds': {'minX': 0, 'minY': 0, 'maxX': 640, 'maxY': 400}},
            'score': {'Resource': {'id': 'score', 'current': 0, 'min': 0, 'max': 999}},
            'coin1': {'Transform': {'x': 120, 'y': 100, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                      'Shape': {'kind': 'circle', 'radius': 9}, 'Color': {'tint': 0xfbbf24, 'alpha': 1}, 'Tag': {'flags': 2}},
            'coin2': {'Transform': {'x': 500, 'y': 140, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                      'Shape': {'kind': 'circle', 'radius': 9}, 'Color': {'tint': 0xfbbf24, 'alpha': 1}, 'Tag': {'flags': 2}},
            'coin3': {'Transform': {'x': 300, 'y': 320, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                      'Shape': {'kind': 'circle', 'radius': 9}, 'Color': {'tint': 0xfbbf24, 'alpha': 1}, 'Tag': {'flags': 2}},
        },
    },
    'dice': {
        'key': 'dice', 'name': '掷骰子', 'description': '掷两颗骰子，按点数比大小/结算——按空格重掷',
        'capabilities': ['a1-transform', 'c1-shape', 'l2-color', 'l5-camera', 'l6-text',
                         'w1-random', 't2-dice-roll', 't2-keybind'],
        'entities': {
            'camera': _CAM,
            'world': {'RandomSeed': {'seed': 12345, 'sequence': 0}},
            'roller': {
                'KeyBinding': {'key': ' ', 'signal': 'roll', 'phase': 'down'},
                'DicePool': {'dice': [{'faces': [{'value': v, 'element': 0} for v in range(1, 7)]},
                                      {'faces': [{'value': v, 'element': 0} for v in range(1, 7)]}],
                             'rollOnSignal': 'roll', 'locked': []},
            },
            'die1': {'Transform': {'x': 250, 'y': 200, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                     'Shape': {'kind': 'box', 'width': 56, 'height': 56}, 'Color': {'tint': 0xf1f5f9, 'alpha': 1},
                     'Text': {'content': '?', **_TEXT}},
            'die2': {'Transform': {'x': 390, 'y': 200, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                     'Shape': {'kind': 'box', 'width': 56, 'height': 56}, 'Color': {'tint': 0xf1f5f9, 'alpha': 1},
                     'Text': {'content': '?', **_TEXT}},
        },
    },
    'cards': {
        'key': 'cards', 'name': '卡牌桌', 'description': '一张扑克牌桌：一手牌 + 出牌评分（Balatro 式底座）',
        'capabilities': ['a1-transform', 'c1-shape', 'l2-color', 'l5-camera', 'l6-text',
                         't2-card-pile', 't2-card-play', 't3-poker-hand', 'f2-flag'],
        'entities': {
            'camera': _CAM,
            'table': {
                'CardPile': {'owner': 'p1', 'deck': list(range(0, 52)), 'hand': [], 'handSize': 5},
                'PlayedHand': {'cards': []},
                'Flag': {'id': 'p1', 'active': False},
            },
            'card1': {'Transform': {'x': 190, 'y': 250, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                      'Shape': {'kind': 'box', 'width': 60, 'height': 84}, 'Color': {'tint': 0xf8fafc, 'alpha': 1},
                      'Text': {'content': 'A', **_TEXT}},
            'card2': {'Transform': {'x': 260, 'y': 250, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                      'Shape': {'kind': 'box', 'width': 60, 'height': 84}, 'Color': {'tint': 0xf8fafc, 'alpha': 1},
                      'Text': {'content': 'K', **_TEXT}},
            'card3': {'Transform': {'x': 330, 'y': 250, 'rotation': 0, 'scaleX': 1, 'scaleY': 1},
                      'Shape': {'kind': 'box', 'width': 60, 'height': 84}, 'Color': {'tint': 0xf8fafc, 'alpha': 1},
                      'Text': {'content': 'Q', **_TEXT}},
        },
    },
}

def _template_manifest(tpl: dict) -> dict:
    """模板条目 → 完整 manifest（name/description/capabilities/entities·深拷贝防污染）。"""
    return {'name': tpl['name'], 'description': tpl['description'],
            'capabilities': list(tpl['capabilities']),
            'entities': json.loads(json.dumps(tpl['entities']))}

# 基础原子（任何题材都注入的最小词表底座）+ 题材能力族（纯数据·命中关键词时整族注入·校验漏词也补它）。
_BASE_ATOM_IDS = ['a1-transform', 'b1-velocity', 'b2-acceleration', 'c1-shape', 'b3-mass', 'l2-color',
                  'l5-camera', 'l6-text', 't1-motion-apply', 't1-accel-apply',
                  'd1-overlap-detect', 't2-collision-resolve', 't2-bounds-clamp']
CAPABILITY_FAMILIES = {
    'platform': ['t2-ground-sense', 't2-jump', 't2-friction', 'i1-input-capture', 'i2-action-map', 'g1-tag'],
    'collect':  ['g1-tag', 't2-trigger-zone', 'f1-resource', 'k2-destroy', 't2-clickable', 't2-text-binding'],
    'dice':     ['w1-random', 't2-dice-roll', 't2-keybind', 't2-event-when', 't2-effect-apply', 'f1-resource', 'f2-flag', 't2-text-binding'],
    'cards':    ['t2-card-pile', 't2-card-play', 't3-poker-hand', 't3-card-scoring', 't2-clickable', 'f1-resource', 'f2-flag', 't2-text-binding'],
    'combat':   ['t2-hitbox', 't2-mortal', 'f1-resource', 'g1-tag', 'k1-spawn', 'k2-destroy', 't2-steering', 'g2-relation'],
    'ui':       ['l6-text', 't2-text-binding', 't2-gauge', 't2-clickable'],
}
# 关键词 → (模板 key, 题材族)。首个命中胜；默认物理弹跳。中英文皆可（英文小写匹配）。
TEMPLATE_KEYWORDS = [
    ('dice',          ['dice', 'ui'],    ['骰', '掷', '色子', '点数', '比大小', 'dice', 'roll']),
    ('cards',         ['cards', 'ui'],   ['卡牌', '扑克', '抽牌', '手牌', '出牌', 'card', 'poker', 'deck', 'balatro']),
    ('pong',          ['platform'],      ['乒乓', '球拍', '弹球', '接球', 'pong', 'paddle']),
    ('platform-jump', ['platform'],      ['平台', '横版', '马里奥', '闯关', '跳跃', 'platform', 'jump', 'mario']),
    ('collect',       ['collect', 'ui'], ['收集', '金币', '吃', '迷宫', '采集', 'collect', 'coin', 'gather', 'maze', 'pac']),
    ('bounce',        ['platform'],      ['弹', '球', '重力', '物理', '掉落', 'bounce', 'ball', 'gravity', 'physics', 'fall']),
]
