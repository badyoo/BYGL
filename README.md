# BYGL
* 一款体积超小的,性能强劲的 H5 WebGL 跨平台游戏引擎
* 本引擎适用于微信小游戏，h5游戏开发
* 不定时更新，目前建议仅用于学习使用，应用起来还有些Bug跟未完善的工能
* 已有绝大部分游戏引擎功能，已经够开发一般的小型游戏

# [展示](https://www.616ko.com/show)
* 请点击左上角的兔子切换场景
* 兔子场景展示基础的性能
* 基础功能场景，包括显示对象，动画，容器等功能
* 鼠标事件场景
* 微信打飞机游戏例子
# 优点：
* 性能比同类引擎高达200%-300%,比目前性能较好的引擎高120%-150%
* 体积更小
* 易用 Flash HTML网页 H5 Unity3d开发者 都能很快上手

# 缺点：
* 功能阉割，只保留大部分用于游戏开发的功能
* 个人业余之作，你可以理解为没有人维护

# 作者
* [badyoo](https://github.com/badyoo)
* QQ:547243998
* 微博:http://weibo.com/badyoo

# 网站
* http://www.616ko.com/
* QQ群:293864103

# 功能
* WebGL
* 动态批处理
* 多点触控
* 鼠标事件
* 纹理图集(支持TexturePacker Flash导出的JSON格式)
* 混合模式
* 循环管理器
* 资源加载器
* HTTP请求
* 容器
* 显示对象(平移,瞄点,缩放,大小,旋转,透明度,是否可见)
* 图片
* 声音
* 可选锚点（默认中心,可选左上角）
* 背景色
* TS/JS es6 工作流(https://github.com/badyoo/FastCodeJS)
* 图集逐帧动画 Sprite
* 自适应

# 开发中功能
* 平台标识
* 图集文本(demo阶段)
* api Doc
* 引擎代码提示 d.ts

# 如何快速开始
	//启动引擎
	badyoo.power();//(游戏宽,游戏高,舞台锚点是中心的,canvas,自定义根容器)
	//创建一个图片
	//对于unity/html开发者来说，你甚至不需要把他添加到舞台,不需要理解显示列表，容器
	var Image = badyoo.Instantiate(badyoo.Image);//对象创建时会自动添加到舞台
	image.skin = "leaves.jpg";

	//对于flash其他h5引擎开发者，什么图层容器都没太low了！
	var layer = badyoo.Instantiate(badyoo.Layer);//创建一个容器添加到舞台
	var Image = layer.Instantiate(badyoo.Image);//创建一个图片添加到容器 layer
	image.skin = "leaves.jpg";
	
	//纳里！我是传统开发者！
	//layer里熟悉的方法、属性 跟你用的flash 其他h5引擎一个样;
	var layer = badyoo.Instantiate(badyoo.Layer);//创建一个容器添加到舞台
	var Image = new badyoo.Image();//创建一个图片
	image.skin = "leaves.jpg";
	layer.addChild(Image);
	
	//还不够！我要flash那套有Main入口文档类的！
	//Main入口 文档类
	class Main extends badyoo.Layer
	{
	  constructor()
	  {
		super()
	  }
	}
	badyoo.power(0,0,false,null,Main);
	

# 使用限制
在游戏加载页或首页的任意可见位置注明：Powered by BYGL

### License
[MIT License](https://github.com/badyoo/BYGL/blob/master/LICENSE)

