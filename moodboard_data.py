# -*- coding: utf-8 -*-
"""
AI Moodboard 趋势库与视觉资产配置
面向快时尚、成人服饰与电商商品企划的趋势雷达与情绪板数据底座
"""

TREND_STYLES = {
    "美式复古学院风 (Ivy League / Preppy)": {
        "title": "美式复古学院风 · 经典常春藤与雅痞格调",
        "benchmark_brands": ["Teenie Weenie", "Ralph Lauren", "Tommy Hilfiger", "Brooks Brothers"],
        "hot_index": "98.4 (小红书/社媒飙升 +142%)",
        "description": "融合 80 年代常春藤盟校制服与现代休闲剪裁，注重重磅针织、复古菱格、牛角扣与徽章刺绣，营造知性、沉稳且具有青春活力的英伦与美式复古氛围。",
        "keywords": ["复古菱格纹", "重磅绞花毛衣", "牛尾灯芯绒", "小熊徽章刺绣", "牛角扣大衣", "乐福鞋", "深墨绿", "卡其暖驼"],
        "palette": [
            {"name": "学院深红 (Cabernet)", "hex": "#6B1D2F", "pantone": "19-1860 TCX"},
            {"name": "森林墨绿 (Forest Green)", "hex": "#1B3B2B", "pantone": "19-5513 TCX"},
            {"name": "经典藏青 (Classic Navy)", "hex": "#0D1B2A", "pantone": "19-4024 TCX"},
            {"name": "暖驼原色 (Warm Camel)", "hex": "#C49A6C", "pantone": "16-1334 TCX"},
            {"name": "复古米白 (Vintage Cream)", "hex": "#F4EBD9", "pantone": "11-0107 TCX"}
        ],
        "fabrics": ["380g 羊毛混纺粗花呢", "8 坑复古棉质灯芯绒", "重磅精梳棉牛津纺", "双股美利奴绞花羊绒"],
        "moodboard_image": "assets/pulse-trend-moodboard-live.png",
        "prompt_template": {
            "en": "Editorial fashion moodboard photography for Teenie Weenie style campaign. A chic East Asian female model wearing a vintage preppy cable-knit sweater in warm camel and a dark forest green pleated tweed skirt. Campus library aesthetic, natural sunlight through tall windows, soft shadows. Shot on 35mm film, Hasselblad H6D-100c, 85mm f/1.4 lens, cinematic lighting, rich fabric textures, photorealistic, 8k resolution.",
            "zh": "美式复古学院风电商商业大片，东亚年轻女模特身穿暖驼色重磅绞花毛衣与墨绿色百褶粗花呢半身裙。常春藤复古图书馆背景，高大拱窗透入柔和午后自然光，胶片质感，哈苏中画幅 85mm 人像镜头，极致面料纹理细节，8k 超高清。"
        }
    },
    "Quiet Luxury 静奢老钱风 (Minimalist Elegance)": {
        "title": "Quiet Luxury · 极简质感与无声奢华",
        "benchmark_brands": ["Loro Piana", "The Row", "Brunello Cucinelli", "COS"],
        "hot_index": "96.2 (行业大盘稳定高热)",
        "description": "摒弃显眼 Logo，以极度考究的高支面料、克制的低饱和大地色谱以及流畅利落的立体剪裁为核心，传递松弛自洽的高级感。",
        "keywords": ["双面羊绒", "低饱和燕麦色", "无结构大衣", "真丝桑蚕丝", "极简廓形", "无五金外露", "哑光真皮"],
        "palette": [
            {"name": "纯正燕麦 (Oatmeal Melange)", "hex": "#D8CFC4", "pantone": "13-0401 TCX"},
            {"name": "冷雾灰褐 (Taupe Mist)", "hex": "#8D8176", "pantone": "17-1310 TCX"},
            {"name": "柔焦炭黑 (Soft Charcoal)", "hex": "#2B2B2A", "pantone": "19-3908 TCX"},
            {"name": "冷灰冰白 (Ice Chalk)", "hex": "#ECEBE4", "pantone": "11-4201 TCX"},
            {"name": "浓缩咖褐 (Espresso)", "hex": "#3E2723", "pantone": "19-1217 TCX"}
        ],
        "fabrics": ["900g 双面精纺阿尔巴卡羊驼毛", "22 姆米重磅桑蚕丝斜纹绸", "高支奢华海岛棉", "无涂层纳帕小羊皮"],
        "moodboard_image": "assets/pulse-ins-real-moodboard.png",
        "prompt_template": {
            "en": "High fashion campaign for Quiet Luxury autumn collection. Minimalist architectural interior with raw concrete and travertine stone. Model in an oversized double-faced cashmere coat in oatmeal tone, relaxed tailored wool trousers. Natural diffuse daylight, Scandinavian minimalism, Leica SL2, 50mm f/1.2 lens, ultra-clean aesthetic, editorial magazine cover quality.",
            "zh": "高端静奢风服饰商业企划大片，极简清水混凝土与洞石建筑空间。模特身穿低饱和燕麦色无结构双面羊绒长大衣与高腰阔腿毛呢裤。北欧极简漫反射自然光，徕卡 50mm 顶级人像定焦，高级松弛感，杂志封面级工业质感。"
        }
    },
    "Gorpcore 山系户外机能风 (Urban Outdoor)": {
        "title": "Gorpcore 山系机能 · 都市漫游与硬核户外",
        "benchmark_brands": ["Arc'teryx", "Salomon", "The North Face", "Descente"],
        "hot_index": "94.8 (秋季出行季环比 +210%)",
        "description": "打通城市日常穿搭与荒野徒步边界，强调防水透气三层压胶、外露抽绳机能五金与模块化机能口袋，兼顾实用防护与视觉张力。",
        "keywords": ["GORE-TEX 压胶", "战术多袋工装", "快拆磁吸扣", "反光热贴条", "防撕裂格纹尼龙", "岩石灰", "荧光点缀"],
        "palette": [
            {"name": "玄武岩灰 (Basalt Rock)", "hex": "#4A4E51", "pantone": "18-4005 TCX"},
            {"name": "山野苔原 (Alpine Moss)", "hex": "#5C6B52", "pantone": "18-0322 TCX"},
            {"name": "极地冰蓝 (Glacier Blue)", "hex": "#8EA8C3", "pantone": "15-4008 TCX"},
            {"name": "防护荧光橙 (Safety Orange)", "hex": "#FF5722", "pantone": "16-1359 TCX"},
            {"name": "暗影夜黑 (Shadow Black)", "hex": "#1A1A1D", "pantone": "19-4007 TCX"}
        ],
        "fabrics": ["70D 三层复合防水透气格纹面料", "Cordura 耐磨防撕裂面料", "PrimaLoft 拒水超轻气凝胶棉", "YKK 防水拉链系统"],
        "moodboard_image": "assets/pulse-trend-final.png",
        "prompt_template": {
            "en": "Urban outdoor Gorpcore commercial lookbook. Model standing on a misty wet asphalt city street against brutalist concrete backdrop. Wearing an olive green technical shell jacket with taped seams, modular cargo pants, and Salomon trail sneakers. Atmospheric rain mist, dramatic neon reflections, dynamic angle, Sony A1, 35mm f/1.4, cinematic cyberpunk realism.",
            "zh": "都市山系机能户外品牌画册，湿漉城市街道与野兽派建筑背景。模特身着苔藓绿三层压胶硬壳冲锋衣与模块化战术工装裤。细雨薄雾氛围，地面微光倒影，索尼微单 35mm 广角构图，硬核机能质感，极致工业级真实感。"
        }
    },
    "新中式禅意国风 (Modern Neo-Chinese)": {
        "title": "新中式禅意国风 · 东方美学与现代剪裁",
        "benchmark_brands": ["Uma Wang", "SAMO", "Ms MIN", "Shanghai Tang"],
        "hot_index": "95.7 (国潮社交爆款词榜首)",
        "description": "东方古典意蕴与当代通勤版型的交融，运用盘扣、立领、斜襟、水墨晕染与非遗香云纱，呈现内敛雅致的东方君子与东方女性气韵。",
        "keywords": ["纯手工盘扣", "非遗香云纱", "水墨晕染真丝", "改良旗袍领", "微喇斜襟", "竹节棉麻", "朱砂红", "黛瓦青"],
        "palette": [
            {"name": "水墨黛黑 (Ink Black)", "hex": "#202124", "pantone": "19-0303 TCX"},
            {"name": "淡竹青碧 (Bamboo Mist)", "hex": "#A3B899", "pantone": "14-6316 TCX"},
            {"name": "故宫朱砂 (Cinnabar Red)", "hex": "#B22222", "pantone": "19-1662 TCX"},
            {"name": "古法赭石 (Ancient Ochre)", "hex": "#8C6239", "pantone": "18-1031 TCX"},
            {"name": "宣纸暖白 (Rice Paper)", "hex": "#FAF0E6", "pantone": "11-0604 TCX"}
        ],
        "fabrics": ["正宗莨绸/重磅香云纱", "天然透气麻棉竹节纱", "100% 桑蚕丝提花素绉缎", "古法草木染粗织布"],
        "moodboard_image": "assets/pulse-trend-perfect.png",
        "prompt_template": {
            "en": "Modern Neo-Chinese fashion editorial photoshoot. Elegant Asian model wearing a contemporary tailored black Xiangyunsha silk blazer with handcrafted frog buttons and bamboo leaf embroidery. Traditional courtyard with courtyard bamboo shadows, soft warm lantern rim light, Hasselblad medium format, artistic composition, museum grade texture, quiet luxury eastern aesthetic.",
            "zh": "现代新中式高级时装企划，东方庭院竹影背景。模特身穿改良版黑色香云纱西装外套，手工盘扣与暗纹刺绣。竹影摇曳与暖色灯笼轮廓光，哈苏中画幅，空灵禅意构图，博物馆级面料质感，东方美学巅峰。"
        }
    }
}

HOT_TREND_DATA = [
    {"rank": 1, "topic": "美式复古红绿撞色菱格开衫", "platform": "小红书", "heat": "952.4w", "tags": "学院风 / Teenie Weenie"},
    {"rank": 2, "topic": "Quiet Luxury 羊绒大衣色彩搭配", "platform": "Instagram", "heat": "918.0w", "tags": "静奢老钱 / 燕麦色"},
    {"rank": 3, "topic": "Gorpcore 暴雨通勤硬壳机能风", "platform": "抖音/TikTok", "heat": "884.2w", "tags": "山系户外 / 压胶防水"},
    {"rank": 4, "topic": "新中式香云纱日常通勤改良款", "platform": "小红书", "heat": "860.5w", "tags": "国风禅意 / 手工盘扣"},
    {"rank": 5, "topic": "复古灯芯绒微喇工装长裤穿搭", "platform": "小红书", "heat": "832.1w", "tags": "复古工装 / 暖驼色"}
]
