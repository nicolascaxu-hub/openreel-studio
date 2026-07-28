#!/usr/bin/env python3
"""Import the curated CC0 short-drama model catalog from official Kenney packs."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.request
import zipfile
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_MODEL_ROOT = PROJECT_ROOT / "apps/web/public/director/models"
CATALOG_PATH = PROJECT_ROOT / "apps/web/lib/directorCommonModels.json"
CATALOG_DOC_PATH = PUBLIC_MODEL_ROOT / "CATALOG.md"
SOURCE_PROP_PATH = PROJECT_ROOT / "apps/web/lib/directorSourceProps.ts"

CATEGORY_ORDER = [
    "家居家具", "厨卫家电", "办公电子", "随身物品", "餐饮食物",
    "商业零售", "医疗教育", "交通车辆", "道路设施", "拍摄器材",
    "自然户外", "建筑场景", "工具杂物", "角色动作", "动画测试",
]

SOURCES = {
    "furniture": {
        "archive": "kenney_furniture-kit.zip",
        "member": "Models/GLTF format/{model}.glb",
        "url": "https://kenney.nl/media/pages/assets/furniture-kit/440e0608a4-1677580847/kenney_furniture-kit.zip",
        "page": "https://kenney.nl/assets/furniture-kit",
        "label": "Kenney Furniture Kit",
    },
    "food": {
        "archive": "kenney_food-kit.zip",
        "member": "Models/GLB format/{model}.glb",
        "url": "https://kenney.nl/media/pages/assets/food-kit/83086fa91c-1719418518/kenney_food-kit.zip",
        "page": "https://kenney.nl/assets/food-kit",
        "label": "Kenney Food Kit",
        "texture": "Models/GLB format/Textures/colormap.png",
    },
    "vehicles": {
        "archive": "kenney_car-kit.zip",
        "member": "Models/GLB format/{model}.glb",
        "url": "https://kenney.nl/media/pages/assets/car-kit/1a312ec241-1775131960/kenney_car-kit.zip",
        "page": "https://kenney.nl/assets/car-kit",
        "label": "Kenney Car Kit",
        "texture": "Models/GLB format/Textures/colormap.png",
    },
    "commercial": {
        "archive": "kenney_city-commercial.zip",
        "member": "Models/GLB format/{model}.glb",
        "url": "https://kenney.nl/media/pages/assets/city-kit-commercial/a742d900eb-1753115042/kenney_city-kit-commercial_2.1.zip",
        "page": "https://kenney.nl/assets/city-kit-commercial",
        "label": "Kenney City Kit (Commercial)",
        "texture": "Models/GLB format/Textures/colormap.png",
    },
    "industrial": {
        "archive": "kenney_city-industrial.zip",
        "member": "Models/GLB format/{model}.glb",
        "url": "https://kenney.nl/media/pages/assets/city-kit-industrial/5fcb837741-1750838303/kenney_city-kit-industrial_1.0.zip",
        "page": "https://kenney.nl/assets/city-kit-industrial",
        "label": "Kenney City Kit (Industrial)",
        "texture": "Models/GLB format/Textures/colormap.png",
    },
    "roads": {
        "archive": "kenney_city-roads.zip",
        "member": "Models/GLB format/{model}.glb",
        "url": "https://kenney.nl/media/pages/assets/city-kit-roads/74288c9459-1741864740/kenney_city-kit-roads.zip",
        "page": "https://kenney.nl/assets/city-kit-roads",
        "label": "Kenney City Kit (Roads)",
        "texture": "Models/GLB format/Textures/colormap.png",
    },
    "nature": {
        "archive": "kenney_nature-kit.zip",
        "member": "Models/GLTF format/{model}.glb",
        "url": "https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip",
        "page": "https://kenney.nl/assets/nature-kit",
        "label": "Kenney Nature Kit",
    },
}


def model(
    pack: str,
    source_name: str,
    name: str,
    category: str,
    keywords: str,
    display_size: float,
) -> dict[str, Any]:
    return {
        "pack": pack,
        "source_name": source_name,
        "name": name,
        "category": category,
        "keywords": keywords.split(),
        "display_size": display_size,
    }


MODELS = [
    # 家居家具
    model("furniture", "bedDouble", "双人床", "家居家具", "床 卧室 酒店 bedroom bed", 2.2),
    model("furniture", "bedSingle", "单人床", "家居家具", "床 卧室 宿舍 bedroom bed", 2.0),
    model("furniture", "bedBunk", "上下床", "家居家具", "床 宿舍 儿童房 bunk bed", 2.3),
    model("furniture", "loungeDesignSofa", "客厅沙发", "家居家具", "沙发 客厅 sofa living-room", 2.4),
    model("furniture", "loungeChair", "单人沙发", "家居家具", "沙发 椅子 armchair", 1.3),
    model("furniture", "tableCoffee", "咖啡桌", "家居家具", "茶几 桌 客厅 coffee-table", 1.4),
    model("furniture", "table", "餐桌", "家居家具", "桌子 餐厅 dining-table", 1.9),
    model("furniture", "tableRound", "圆桌", "家居家具", "桌子 餐厅 round-table", 1.8),
    model("furniture", "chairCushion", "餐椅", "家居家具", "椅子 餐厅 chair", 1.1),
    model("furniture", "stoolBar", "吧椅", "家居家具", "凳子 酒吧 stool", 1.2),
    model("furniture", "sideTableDrawers", "床头柜", "家居家具", "柜子 卧室 nightstand", 0.9),
    model("furniture", "bookcaseOpen", "开放书架", "家居家具", "书柜 书架 bookshelf", 2.0),
    model("furniture", "books", "一摞书", "家居家具", "书籍 文件 books", 0.45),
    model("furniture", "coatRackStanding", "落地衣架", "家居家具", "衣架 门厅 coat-rack", 1.9),
    model("furniture", "cabinetTelevision", "电视柜", "家居家具", "柜子 客厅 tv-cabinet", 1.8),
    model("furniture", "televisionModern", "电视机", "家居家具", "电视 屏幕 tv", 1.6),
    model("furniture", "lampRoundFloor", "落地灯", "家居家具", "灯具 floor-lamp", 1.8),
    model("furniture", "lampRoundTable", "台灯", "家居家具", "灯具 table-lamp", 0.7),
    model("furniture", "pottedPlant", "室内盆栽", "家居家具", "植物 绿植 plant", 1.2),
    model("furniture", "rugRectangle", "长方地毯", "家居家具", "地毯 rug carpet", 2.3),
    model("furniture", "pillow", "枕头", "家居家具", "抱枕 pillow", 0.65),
    model("furniture", "ceilingFan", "吊扇", "家居家具", "风扇 ceiling-fan", 1.6),
    model("furniture", "bear", "玩具熊", "家居家具", "玩具 毛绒熊 teddy bear", 0.8),
    model("furniture", "cardboardBoxClosed", "封闭纸箱", "家居家具", "纸箱 快递 搬家 box", 0.8),
    model("furniture", "cardboardBoxOpen", "打开纸箱", "家居家具", "纸箱 快递 搬家 box", 0.8),
    # 厨卫家电
    model("furniture", "bathroomCabinetDrawer", "浴室柜", "厨卫家电", "浴室 柜子 bathroom", 1.2),
    model("furniture", "bathroomMirror", "浴室镜", "厨卫家电", "镜子 浴室 mirror", 1.0),
    model("furniture", "bathroomSink", "洗手池", "厨卫家电", "水池 浴室 sink", 1.1),
    model("furniture", "bathtub", "浴缸", "厨卫家电", "浴室 洗澡 bathtub", 1.9),
    model("furniture", "shower", "淋浴间", "厨卫家电", "浴室 洗澡 shower", 2.1),
    model("furniture", "toilet", "马桶", "厨卫家电", "卫生间 toilet", 1.1),
    model("furniture", "kitchenBar", "厨房岛台", "厨卫家电", "厨房 吧台 island", 1.9),
    model("furniture", "kitchenBlender", "料理机", "厨卫家电", "搅拌机 厨房 blender", 0.55),
    model("furniture", "kitchenCabinet", "厨房地柜", "厨卫家电", "橱柜 厨房 cabinet", 1.2),
    model("furniture", "kitchenCabinetUpper", "厨房吊柜", "厨卫家电", "橱柜 厨房 cabinet", 1.1),
    model("furniture", "kitchenCoffeeMachine", "咖啡机", "厨卫家电", "厨房 咖啡 coffee-machine", 0.65),
    model("furniture", "kitchenFridge", "冰箱", "厨卫家电", "厨房 电器 refrigerator", 2.0),
    model("furniture", "kitchenMicrowave", "微波炉", "厨卫家电", "厨房 电器 microwave", 0.75),
    model("furniture", "kitchenSink", "厨房水槽", "厨卫家电", "厨房 水池 sink", 1.2),
    model("furniture", "kitchenStove", "燃气灶台", "厨卫家电", "厨房 炉灶 stove", 1.2),
    model("furniture", "toaster", "烤面包机", "厨卫家电", "厨房 电器 toaster", 0.45),
    model("furniture", "trashcan", "家用垃圾桶", "厨卫家电", "垃圾桶 bin", 0.75),
    model("furniture", "washer", "洗衣机", "厨卫家电", "家电 laundry washer", 1.1),
    model("furniture", "dryer", "烘干机", "厨卫家电", "家电 laundry dryer", 1.1),
    # 办公电子
    model("furniture", "computerKeyboard", "电脑键盘", "办公电子", "键盘 办公 keyboard", 0.55),
    model("furniture", "computerMouse", "电脑鼠标", "办公电子", "鼠标 办公 mouse", 0.22),
    model("furniture", "computerScreen", "桌面显示器", "办公电子", "电脑 屏幕 monitor", 0.85),
    model("furniture", "desk", "办公桌", "办公电子", "桌子 办公 office-desk", 1.8),
    model("furniture", "deskCorner", "转角办公桌", "办公电子", "桌子 办公 corner-desk", 2.2),
    model("furniture", "chairDesk", "办公椅", "办公电子", "椅子 办公 office-chair", 1.2),
    model("furniture", "laptop", "笔记本电脑", "办公电子", "电脑 办公 laptop", 0.65),
    model("furniture", "radio", "收音机", "办公电子", "音响 radio", 0.55),
    model("furniture", "speaker", "落地音箱", "办公电子", "音响 speaker", 1.2),
    model("furniture", "speakerSmall", "桌面音箱", "办公电子", "音响 speaker", 0.45),
    model("furniture", "tableCross", "会议桌", "办公电子", "桌子 会议 meeting-table", 2.2),
    # 餐饮食物
    model("food", "apple", "苹果", "餐饮食物", "水果 apple", 0.22),
    model("food", "banana", "香蕉", "餐饮食物", "水果 banana", 0.28),
    model("food", "orange", "橙子", "餐饮食物", "水果 orange", 0.22),
    model("food", "grapes", "葡萄", "餐饮食物", "水果 grapes", 0.28),
    model("food", "strawberry", "草莓", "餐饮食物", "水果 strawberry", 0.18),
    model("food", "watermelon", "西瓜", "餐饮食物", "水果 watermelon", 0.42),
    model("food", "pineapple", "菠萝", "餐饮食物", "水果 pineapple", 0.42),
    model("food", "avocado", "牛油果", "餐饮食物", "水果 avocado", 0.22),
    model("food", "carrot", "胡萝卜", "餐饮食物", "蔬菜 carrot", 0.28),
    model("food", "broccoli", "西兰花", "餐饮食物", "蔬菜 broccoli", 0.28),
    model("food", "tomato", "番茄", "餐饮食物", "蔬菜 tomato", 0.22),
    model("food", "pumpkin", "南瓜", "餐饮食物", "蔬菜 pumpkin", 0.38),
    model("food", "bread", "面包", "餐饮食物", "主食 bread", 0.35),
    model("food", "croissant", "牛角包", "餐饮食物", "面包 croissant", 0.28),
    model("food", "burger", "汉堡", "餐饮食物", "快餐 burger", 0.28),
    model("food", "pizza", "披萨", "餐饮食物", "快餐 pizza", 0.42),
    model("food", "sandwich", "三明治", "餐饮食物", "快餐 sandwich", 0.28),
    model("food", "chinese", "中式外卖盒", "餐饮食物", "外卖 中餐 takeout", 0.3),
    model("food", "dim-sum", "点心", "餐饮食物", "中餐 dimsum", 0.25),
    model("food", "sushi-salmon", "三文鱼寿司", "餐饮食物", "日料 sushi", 0.22),
    model("food", "taco", "塔可", "餐饮食物", "快餐 taco", 0.26),
    model("food", "salad", "沙拉", "餐饮食物", "餐食 salad", 0.35),
    model("food", "turkey", "烤火鸡", "餐饮食物", "餐食 turkey", 0.5),
    model("food", "egg-cooked", "煎蛋", "餐饮食物", "早餐 egg", 0.22),
    model("food", "fish", "整鱼", "餐饮食物", "海鲜 fish", 0.38),
    model("food", "meat-cooked", "煎肉排", "餐饮食物", "肉类 steak", 0.32),
    model("food", "cake-birthday", "生日蛋糕", "餐饮食物", "甜点 蛋糕 birthday-cake", 0.45),
    model("food", "donut", "甜甜圈", "餐饮食物", "甜点 donut", 0.22),
    model("food", "cookie", "曲奇饼干", "餐饮食物", "甜点 cookie", 0.18),
    model("food", "bowl", "餐碗", "餐饮食物", "餐具 bowl", 0.28),
    model("food", "cup-coffee", "咖啡杯", "餐饮食物", "餐具 coffee cup", 0.25),
    model("food", "mug", "马克杯", "餐饮食物", "餐具 mug", 0.25),
    model("food", "glass-wine", "高脚酒杯", "餐饮食物", "餐具 wine-glass", 0.28),
    model("food", "plate-dinner", "餐盘", "餐饮食物", "餐具 plate", 0.32),
    model("food", "utensil-fork", "餐叉", "餐饮食物", "餐具 fork", 0.24),
    model("food", "utensil-knife", "餐刀", "餐饮食物", "餐具 knife", 0.25),
    model("food", "utensil-spoon", "餐勺", "餐饮食物", "餐具 spoon", 0.24),
    model("food", "chopstick", "筷子", "餐饮食物", "餐具 chopsticks", 0.26),
    model("food", "cooking-knife", "菜刀", "餐饮食物", "厨具 knife", 0.35),
    model("food", "frying-pan", "平底锅", "餐饮食物", "厨具 pan", 0.5),
    model("food", "pot-stew", "炖锅", "餐饮食物", "厨具 pot", 0.48),
    model("food", "cutting-board", "砧板", "餐饮食物", "厨具 cutting-board", 0.45),
    model("food", "soda-bottle", "饮料瓶", "餐饮食物", "饮料 bottle", 0.32),
    model("food", "soda-can", "易拉罐", "餐饮食物", "饮料 can", 0.2),
    model("food", "wine-red", "红酒瓶", "餐饮食物", "酒水 wine", 0.38),
    # 交通车辆
    model("vehicles", "ambulance", "救护车", "交通车辆", "医疗 车辆 ambulance", 4.8),
    model("vehicles", "delivery", "快递货车", "交通车辆", "物流 车辆 delivery", 4.8),
    model("vehicles", "firetruck", "消防车", "交通车辆", "消防 车辆 firetruck", 5.4),
    model("vehicles", "garbage-truck", "垃圾清运车", "交通车辆", "环卫 车辆 garbage-truck", 5.2),
    model("vehicles", "hatchback-sports", "两厢轿车", "交通车辆", "汽车 hatchback", 4.2),
    model("vehicles", "police", "警车", "交通车辆", "警察 车辆 police-car", 4.5),
    model("vehicles", "sedan-sports", "运动轿车", "交通车辆", "汽车 sports-car", 4.4),
    model("vehicles", "sedan", "家用轿车", "交通车辆", "汽车 sedan", 4.5),
    model("vehicles", "suv", "越野车", "交通车辆", "汽车 suv", 4.7),
    model("vehicles", "taxi", "出租车", "交通车辆", "汽车 taxi", 4.5),
    model("vehicles", "truck", "厢式卡车", "交通车辆", "货车 truck", 5.2),
    model("vehicles", "van", "面包车", "交通车辆", "汽车 van", 4.8),
    model("vehicles", "tractor", "拖拉机", "交通车辆", "农用车 tractor", 4.2),
    # 建筑场景
    model("commercial", "building-a", "临街商铺", "建筑场景", "建筑 商店 storefront", 8.0),
    model("commercial", "building-b", "餐厅建筑", "建筑场景", "建筑 餐厅 restaurant", 8.0),
    model("commercial", "building-c", "办公楼", "建筑场景", "建筑 办公 office", 9.0),
    model("commercial", "building-d", "城市公寓", "建筑场景", "建筑 住宅 apartment", 9.0),
    model("commercial", "building-e", "酒店建筑", "建筑场景", "建筑 酒店 hotel", 9.0),
    model("commercial", "building-f", "便利店建筑", "建筑场景", "建筑 商店 convenience-store", 8.0),
    model("commercial", "building-skyscraper-a", "城市高层建筑", "建筑场景", "建筑 写字楼 skyscraper", 12.0),
    model("commercial", "detail-awning-wide", "商铺遮阳棚", "建筑场景", "商店 遮阳棚 awning", 3.0),
    model("commercial", "detail-parasol-a", "商业遮阳伞", "建筑场景", "户外 遮阳伞 parasol", 2.6),
    model("industrial", "building-a", "厂房", "建筑场景", "建筑 工厂 factory", 9.0),
    model("industrial", "building-b", "仓库", "建筑场景", "建筑 仓库 warehouse", 9.0),
    model("industrial", "chimney-large", "工业烟囱", "建筑场景", "工厂 烟囱 chimney", 8.0),
    model("industrial", "detail-tank", "工业储罐", "建筑场景", "工厂 储罐 tank", 5.0),
    # 道路设施
    model("roads", "construction-barrier", "施工围栏", "道路设施", "道路 施工 barrier", 2.0),
    model("roads", "construction-cone", "交通锥", "道路设施", "道路 路障 cone", 0.75),
    model("roads", "construction-light", "施工警示灯", "道路设施", "道路 警示灯 light", 1.2),
    model("roads", "light-curved", "弯杆路灯", "道路设施", "街道 路灯 streetlight", 5.0),
    model("roads", "light-square-double", "双头路灯", "道路设施", "街道 路灯 streetlight", 5.0),
    model("roads", "road-crossing", "人行横道", "道路设施", "道路 斑马线 crossing", 5.0),
    model("roads", "road-crossroad", "十字路口", "道路设施", "道路 路口 crossroad", 6.0),
    model("roads", "road-roundabout", "环岛道路", "道路设施", "道路 环岛 roundabout", 6.0),
    model("roads", "road-straight", "直行道路", "道路设施", "道路 road", 5.0),
    model("roads", "road-bridge", "公路桥面", "道路设施", "道路 桥 bridge", 6.0),
    model("roads", "road-end", "道路尽头", "道路设施", "道路 road-end", 5.0),
    model("roads", "sign-highway-detailed", "道路指示牌", "道路设施", "道路 标牌 sign", 3.0),
    # 自然户外
    model("nature", "cactus_tall", "高仙人掌", "自然户外", "植物 沙漠 cactus", 2.2),
    model("nature", "campfire_stones", "石围篝火", "自然户外", "露营 火堆 campfire", 1.2),
    model("nature", "canoe", "独木舟", "自然户外", "船 水面 canoe", 3.2),
    model("nature", "canoe_paddle", "船桨", "自然户外", "船桨 paddle", 1.8),
    model("nature", "fence_gate", "木栅栏门", "自然户外", "栅栏 fence gate", 2.0),
    model("nature", "flower_redA", "红花簇", "自然户外", "花朵 flower", 0.45),
    model("nature", "grass_large", "草丛", "自然户外", "草地 grass", 0.7),
    model("nature", "plant_bushDetailed", "灌木丛", "自然户外", "植物 bush", 1.2),
    model("nature", "pot_large", "户外花盆", "自然户外", "花盆 pot", 0.8),
    model("nature", "rock_largeA", "大型岩石", "自然户外", "石头 rock", 1.8),
    model("nature", "log_stack", "木柴堆", "自然户外", "木材 log", 1.2),
    model("nature", "tent_detailedOpen", "露营帐篷", "自然户外", "露营 tent", 2.6),
    model("nature", "tree_oak", "橡树", "自然户外", "树木 oak tree", 5.0),
    model("nature", "tree_palmTall", "高棕榈树", "自然户外", "树木 palm", 5.5),
    model("nature", "tree_pineTallA_detailed", "高松树", "自然户外", "树木 pine", 5.5),
    model("nature", "bridge_wood", "木桥", "自然户外", "桥梁 wood bridge", 3.5),
    model("nature", "crops_cornStageD", "成熟玉米植株", "自然户外", "农田 玉米 corn", 2.0),
    model("nature", "crop_pumpkin", "南瓜植株", "自然户外", "农田 南瓜 pumpkin", 0.8),
    model("nature", "sign", "木制指示牌", "自然户外", "标牌 sign", 1.6),
    model("nature", "statue_column", "石质立柱", "自然户外", "雕塑 柱子 statue", 2.5),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive-dir", type=Path, default=Path("/tmp"))
    parser.add_argument("--download", action="store_true", help="Download missing source archives")
    return parser.parse_args()


def ensure_archive(source: dict[str, str], archive_dir: Path, download: bool) -> Path:
    target = archive_dir / source["archive"]
    if target.is_file():
        return target
    if not download:
        raise FileNotFoundError(f"Missing {target}; rerun with --download")
    archive_dir.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(source["url"], target)
    return target


def write_catalog_doc(records: list[dict[str, Any]]) -> None:
    source_props = [
        {"id": f"bundled:source:{match[0]}", "name": match[1], "category": match[2], "kind": "OpenReel 源码模型"}
        for match in re.findall(
            r'\{ id: "([^"]+)", name: "([^"]+)", category: "([^"]+)"',
            SOURCE_PROP_PATH.read_text(encoding="utf-8"),
        )
    ]
    featured = [
        {"id": "bundled:fox", "name": "动画狐狸", "category": "角色动作", "kind": "Khronos glTF"},
        {"id": "bundled:rigged-figure", "name": "骨骼人物", "category": "角色动作", "kind": "Khronos glTF"},
        {"id": "bundled:animated-box", "name": "动画方块", "category": "动画测试", "kind": "Khronos glTF"},
        {"id": "bundled:toy-car", "name": "玩具车", "category": "交通车辆", "kind": "Khronos glTF"},
    ]
    entries = featured + [
        {"id": item["id"], "name": item["name"], "category": item["category"], "kind": "Kenney CC0 GLB"}
        for item in records
    ] + source_props
    lines = [
        "# OpenReel 导演台短剧常用模型清单",
        "",
        "这份清单是导演台项目模型库的源码合同。清单中的每一项都必须有可预览、可放置的真实 3D 模型；不接受仅有名称的占位项。",
        "",
        f"- 当前总数：**{len(entries)}**",
        "- 外部资产：Kenney 官方 CC0 资产包、Khronos glTF Sample Assets",
        "- 专用补充：OpenReel 源码组合模型，用于医疗、片场、随身物和商业设备",
        "",
        "## 分类清单",
        "",
    ]
    for category in CATEGORY_ORDER:
        items = [item for item in entries if item["category"] == category]
        if not items:
            continue
        lines.extend([f"### {category}（{len(items)}）", ""])
        lines.extend(f'- [x] {item["name"]} (`{item["id"]}` · {item["kind"]})' for item in items)
        lines.append("")
    lines.extend([
        "## 许可与来源",
        "",
        "- Kenney 模型：CC0 1.0 Universal；各资产包页面和下载地址记录在 `apps/web/lib/directorCommonModels.json`。",
        "- Khronos 模型：逐模型许可记录在 `THIRD_PARTY_LICENSES.md`。",
        "- OpenReel 源码模型：项目自有组合几何，无外部二进制依赖。",
        "",
    ])
    CATALOG_DOC_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    args = parse_args()
    sys.path.insert(0, str(PROJECT_ROOT / "apps/api"))
    from app.services.director_glb import analyze_glb_file

    archives: dict[str, zipfile.ZipFile] = {}
    try:
        for key, source in SOURCES.items():
            archives[key] = zipfile.ZipFile(ensure_archive(source, args.archive_dir, args.download))

        for key, source in SOURCES.items():
            texture_member = source.get("texture")
            if not texture_member:
                continue
            texture_target = PUBLIC_MODEL_ROOT / "kenney" / key / "Textures" / "colormap.png"
            texture_target.parent.mkdir(parents=True, exist_ok=True)
            texture_target.write_bytes(archives[key].read(texture_member))

        records: list[dict[str, Any]] = []
        expected_paths: set[Path] = set()
        for item in MODELS:
            source = SOURCES[item["pack"]]
            member = source["member"].format(model=item["source_name"])
            target_dir = PUBLIC_MODEL_ROOT / "kenney" / item["pack"]
            target_dir.mkdir(parents=True, exist_ok=True)
            target = target_dir / f'{item["source_name"]}.glb'
            target.write_bytes(archives[item["pack"]].read(member))
            expected_paths.add(target)
            analysis = analyze_glb_file(target)
            digest = hashlib.sha256(target.read_bytes()).hexdigest()
            records.append({
                "id": f'bundled:kenney:{item["pack"]}:{item["source_name"]}',
                "name": item["name"],
                "file_name": target.name,
                "file_path": target.relative_to(PUBLIC_MODEL_ROOT).as_posix(),
                "size": target.stat().st_size,
                "sha256": digest,
                "category": item["category"],
                "keywords": item["keywords"],
                "summary": f'{item["category"]}常用模型 · {source["label"]}',
                "license": "CC0 1.0 Universal · Kenney",
                "source": source["page"],
                "display_size": item["display_size"],
                "stats": {
                    "node_count": analysis["node_count"],
                    "mesh_count": analysis["mesh_count"],
                    "material_count": analysis["material_count"],
                    "bone_count": analysis["bone_count"],
                    "animation_count": analysis["animation_count"],
                },
            })

        kenney_root = PUBLIC_MODEL_ROOT / "kenney"
        for existing in kenney_root.rglob("*.glb") if kenney_root.exists() else []:
            if existing not in expected_paths:
                existing.unlink()

        payload = {
            "version": 1,
            "license": "CC0 1.0 Universal",
            "source": "Kenney",
            "sources": [
                {"key": key, "label": source["label"], "page": source["page"], "archive": source["url"]}
                for key, source in SOURCES.items()
            ],
            "models": records,
        }
        CATALOG_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        write_catalog_doc(records)
        print(f"Imported {len(records)} director models into {PUBLIC_MODEL_ROOT / 'kenney'}")
    finally:
        for archive in archives.values():
            archive.close()


if __name__ == "__main__":
    main()
