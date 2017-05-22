(function(window)
{
    'use strict';
    var badyoo = {};
    window["badyoo"] = badyoo;
    badyoo.registerClass = function(cla,name)
    {
        cla.__class = name;
        badyoo[name] = cla;
    }

    class Shader
    {
        constructor(vs,ps)
        {
            this.index = 0;
            this.Uindex = 0;
            this.program = badyoo.current.createProgram(vs,ps);
        }

        bind()
        {
            badyoo.current.gl.useProgram(this.program);
        }

        AttribLocation(v)
        {
            this["a_"+this.index++] = badyoo.current.gl.getAttribLocation(this.program,v);
        }

        AttriUniformLocation(v)
        {
            this["u_"+this.Uindex++] = badyoo.current.gl.getUniformLocation(this.program,v);
        }

        uploadAttrib(index,size,type,normalize = false,stride = 0,offset = 0)
        {
            badyoo.current.gl.enableVertexAttribArray(this["a_"+index]);
            badyoo.current.gl.vertexAttribPointer(this["a_"+index], size, type, normalize, stride, offset);
        }

        uploadUniform2f(index,a,b)
        {
            if( this["u_"+index] ) badyoo.current.gl.uniform2f(this["u_"+index],a,b);
        }

        uploadUniform1f(index,a)
        {
            if( this["u_"+index] ) badyoo.current.gl.uniform1f(this["u_"+index],a);
        }

    }
    class BYGL
    {
        constructor()
        {
            this.debug = true;
            this.root = null;
            this.randerList = [];
            this.G_a = this.G_r = this.G_g = this.G_b = 0;
            this.G_m = new Matrix();
        }        
        init(width,height,root,alignC,canvas)
        {
            var self = this;
            if( root == null ) self.root = new Layer();
            else self.root = new root();
            self.window = window;
            self.canvas = canvas;
            self.alignC = alignC;
            if( width ) self.width = width;
            if( height ) self.height = height;

            if(  self.canvas == null )
            {
                self.canvas = window.document.createElement("canvas");
                var style = self.canvas.style;
                style.position = 'absolute';
                style.top = style.left = "0px";
                style.background = "#000000";
                window.document.body.appendChild(self.canvas);
            }

            self.canvas.width = self.width ? self.width : self.width = window.innerWidth;
            self.canvas.height = self.height ? self.height : self.height = window.innerHeight;

            self.gl = self.canvas.getContext("webgl",
            { 
                antialias: false, 
                premultipliedAlpha: true
            }
            );
            if( !self.gl ) 
            {
                console.error("webgl Not Supported!");
                return;
            }
            console.warn("init w:"+self.width+" h:"+self.height);


            var vs = `attribute vec4 a_position;
            uniform vec2 u_re;
            varying vec2 v_texCoord;
            void main() {
                v_texCoord = a_position.zw;
                vec2 temp = a_position.xy * u_re`+ (self.alignC == false ? "-1.0;" :";")+
            `
                gl_Position = vec4(temp.x,-temp.y,0,1);
            }`;
            var fs = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_texture;
            void main(){
                gl_FragColor = texture2D(u_texture, v_texCoord);
            }`
            ;
            var fsA = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_texture;
            uniform float u_alpha;
            void main(){
                gl_FragColor = texture2D(u_texture, v_texCoord)*u_alpha;
            }`
            ;

            var shader = new Shader(vs,fsA);
            shader.AttribLocation("a_position");
            shader.AttriUniformLocation("u_re");
            shader.AttriUniformLocation("u_alpha");
            shader.bind();

            var px = 2/self.gl.canvas.width;
            var py = 2/self.gl.canvas.height;
            shader.uploadUniform2f(0,px,py);
            self.spriteAProgram = shader;
            var shader = new Shader(vs,fs);
            shader.AttribLocation("a_position");
            shader.AttriUniformLocation("u_re");
            shader.bind();
            shader.uploadUniform2f(0,px,py);
            self.spriteProgram = shader;
            self.indexBuffer = self.createIndexBuffer(65536/4);
            for( var i = 0;i<=360;i++ )
            {
                var a = i * Math.PI / 180;
                Maths.sin[i] = Math.sin(a);
                Maths.cos[i] = Math.cos(a);
            }
            self.time = Date.now();
            var w = window;
            w.requestAnimationFrame = w.requestAnimationFrame || w.webkitRequestAnimationFrame || w.mozRequestAnimationFrame || w.oRequestAnimationFrame || w.msRequestAnimationFrame;
            w.requestAnimationFrame(update);
            function update(v)
            {
                var t = Date.now();
                console.log( t -self.time);
                self.time = t;
                self.update();
                w.requestAnimationFrame(update);
                //console.log(self.batch);
            }
        }

        createIndexBuffer(num)
        {
            var self = this;
            //Indexbuffer webgl1.0 只支持16位uint
            if( num  > 16384 ) num = 16384;
            var buffer = new ArrayBuffer(num  * 2 * 6);
            var uint16Array = new Uint16Array(buffer);
            for( var i = 0;i<num;i++ )
            {
                var index = i * 6;
                var index3 = i * 4;
                uint16Array[index++] = index3;
                uint16Array[index++] = index3+1;
                uint16Array[index++] = index3+2;
                uint16Array[index++] = index3+2;
                uint16Array[index++] = index3+1;
                uint16Array[index++] = index3+3;
            }
            var indexBuffer = self.gl.createBuffer();
            self.gl.bindBuffer(self.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            self.gl.bufferData(self.gl.ELEMENT_ARRAY_BUFFER,uint16Array,self.gl.STATIC_DRAW);
            return indexBuffer;
        }

        createAttachShader(type, source) 
        {
            var self = this;
            var shader = self.gl.createShader(type);
            self.gl.shaderSource(shader, source);
            self.gl.compileShader(shader);

            var success = self.gl.getShaderParameter(shader, self.gl.COMPILE_STATUS);
            if (success) return shader;

            if( self.debug ) console.log(self.gl.getShaderInfoLog(shader));

            self.gl.deleteShader(shader);
        }

        createProgram(vs, fs) {
            var self = this;
            var vertexShader = self.createAttachShader(self.gl.VERTEX_SHADER,vs)
            var fragmentShader = self.createAttachShader(self.gl.FRAGMENT_SHADER,fs)
            var program = self.gl.createProgram();
            self.gl.attachShader(program, vertexShader);
            self.gl.attachShader(program, fragmentShader);
            self.gl.linkProgram(program);
            var success = self.gl.getProgramParameter(program, self.gl.LINK_STATUS);
            if (success) return program;
            if( self.debug ) console.log(self.gl.getProgramInfoLog(program));
            self.gl.deleteProgram(program);
        }

        uploadTexture(img)
        {
            var gl = this.gl;
            var texture = gl.createTexture();
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            // 非二次幂
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            // 上传
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            return texture;
        }

        update()
        {
            var self = this;
            self.resetRender();
            //清除画布
            self.gl.clearColor(self.G_r, self.G_g, self.G_b, self.G_a);
            self.gl.clear(self.gl.COLOR_BUFFER_BIT);

           // var t = Date.now();
            self.transform(self.root,self.root.alpha,self.root.matrix);
            //console.log( Date.now()-t);
            self.randerList.push([self.drawNum,self.drawStart,self.G_texture,self.G_NBlendMode,self.G_alpha]);
            self.drawNum = 0;
            //顶点缓冲区
            var positionBuffer = self.positionBuffer;
            if( positionBuffer == null ) self.positionBuffer = positionBuffer = self.gl.createBuffer();
            self.gl.bindBuffer(self.gl.ARRAY_BUFFER, positionBuffer)
            self.gl.bufferData(self.gl.ARRAY_BUFFER,new Float32Array(self.posionList),self.gl.STATIC_DRAW);
       
             for( var i = 0;i<self.randerList.length;i++ )
            {
                self.render(self.randerList[i]);
            }
            
        }

        transform(layer,alpha,matrix)
        {
            var self = this;
            var arr = self.posionList || (self.posionList = []);
            var list = layer.displayList;
            var len = layer.displayNum;
            var alpha = layer.alpha * alpha;
            for( var i = 0;i<len;i++ )
            {
                var gameObect = list[i];
                var oA = gameObect.alpha * alpha;
                var tempMatrix = gameObect.matrix;
                var x = gameObect.x - tempMatrix.tx;
                var y = gameObect.y - tempMatrix.ty;
                var childMatrix = Pool.get(Matrix);
                childMatrix.set(
					matrix.a * tempMatrix.a + matrix.c * tempMatrix.b,
					matrix.b * tempMatrix.a + matrix.d * tempMatrix.b,
					matrix.a * tempMatrix.c + matrix.c * tempMatrix.d,
					matrix.b * tempMatrix.c + matrix.d * tempMatrix.d,
					matrix.tx + matrix.a * x + matrix.c * y,
					matrix.ty + matrix.b * x + matrix.d * y
				);
                if( gameObect.visible && oA !== 0 )
                {
                    if( gameObect.displayList )
                    {
                        self.transform(gameObect,oA,childMatrix);
                    }
                    else
                    {
                        if( gameObect.m_texture )
                        {
                            if( (self.G_texture != null && self.G_texture != gameObect.m_texture.tex )
                                || (  self.G_blendMode != null && gameObect.blendMode != self.G_blendMode )
                                || ( oA != self.G_alpha ))
                            {
                                self.randerList.push([self.drawNum,self.drawStart,self.G_texture,self.G_NBlendMode,self.G_alpha]);
                                self.drawStart = i*12;//原先是*6，但是显示异常，多间隔一个矩形，显示就不会异常了，不知道为什么~
                                self.drawNum = 0;
                            }

                            self.G_texture = gameObect.m_texture.tex;
                            self.G_NBlendMode = gameObect.blendMode;
                            self.G_alpha = oA;

                            var w = gameObect.width;
                            var h = gameObect.height;
                            var tx = childMatrix.tx;
                            var ty = childMatrix.ty;

                            var wa = childMatrix.a * w;
                            var wb = childMatrix.b * w;
                            var hc = childMatrix.c * h;
                            var hd = childMatrix.d * h;

                            arr[this.index++] = tx;
                            arr[this.index++] = ty;
                            arr[this.index++] = 0;
                            arr[this.index++] = 0;

                            arr[this.index++] = tx+wa;
                            arr[this.index++] = ty+wb;
                            arr[this.index++] = 1;
                            arr[this.index++] = 0;

                            arr[this.index++] = tx+hc;
                            arr[this.index++] = ty+hd;
                            arr[this.index++] = 0;
                            arr[this.index++] = 1;

                            arr[this.index++] = tx+wa+hc;
                            arr[this.index++] = ty+wb+hd;
                            arr[this.index++] = 1;
                            arr[this.index++] = 1;
                            this.drawNum+=6;
                        }
                    }
                }

                Pool.set(Matrix,childMatrix);
            }
        }

        resetRender()
        {
            var self = this;
            self.randerList.length = 0;
            self.G_texture = null;
            self.G_program = null;
            self.G_alpha = 1;
            self.batch = 0;
            self.drawNum = 0;
            self.drawStart = 0;
            self.index = 0;
        }

        render(arr)
        {
            if( arr[0] == 0 ) return;
            var self = this;
            self.G_alpha = arr[4];
            this.G_texture = arr[2];
            //混合模式
            if( self.G_blendMode != arr[3] )
            {
                self.G_blendMode = arr[3];
                self.gl.enable(self.gl.BLEND);
                BlendMode["b"+this.G_blendMode](self.gl);
            }

            var shader = self.G_alpha != 1 ?  self.spriteAProgram : self.spriteProgram;
            shader.bind();
            shader.uploadUniform1f(1,self.G_alpha);
            //顶点缓冲区
            self.gl.bindBuffer(self.gl.ARRAY_BUFFER, self.positionBuffer)
            shader.uploadAttrib(0,4,self.gl.FLOAT);
            //顶点索引缓冲区
            self.gl.bindBuffer(self.gl.ELEMENT_ARRAY_BUFFER,self.indexBuffer);
            //纹理
            self.gl.bindTexture(self.gl.TEXTURE_2D,this.G_texture);
            //绘制
            self.gl.drawElements(self.gl.TRIANGLES,arr[0],self.gl.UNSIGNED_SHORT, arr[1]);
            self.batch ++;
        }
    }
    badyoo.registerClass(BYGL,"BYGL");

    class Matrix
    {
        constructor()
        {
            this.i();
        }
        set(a = 1, b = 0,c = 0,d = 1,tx = 0,ty = 0)
        {
            this.a = a;//x1
            this.b = b;//x1
            this.c = c;//y1
            this.d = d;//y1
            this.tx =tx;
            this.ty =ty;
        }
        i()
        {
            this.a = 1;
            this.b = 0;
            this.c = 0;
            this.d = 1;
            this.tx = 0;
            this.ty = 0;
        }
        t(x,y)
        {
            this.tx += x;
            this.ty += y;
        }
        r(r)
        {
            var c = Maths.cos[r];
            var s = Maths.sin[r];
            this.a *= c;
            this.b *= -s;
            this.c *= s;
            this.d *= c;
        }
        s(x,y)
        {
            this.a *= x;
            this.b *= x;
            this.c *= y;
            this.d *= y;
            this.tx *= x;
            this.ty *= y;
        }

    }
    badyoo.registerClass(Matrix,"Matrix");

    class Maths
    {
        static random(start,end)
        {
            return ( Math.random() * (end - start) | 0 ) + start;
        }
    }
    Maths.cos ={};
    Maths.sin ={};

    badyoo.registerClass(Maths,"Maths");

    class Pool
    {
        static get(cla)
        {
            var key = cla.__class;
            var arr = Pool[key] || (Pool[key] = []);
            var obj = Pool[key].shift();
            if( obj == null ) return new cla();
            return obj;
        }

        static set(cla,obj)
        {
            var key = cla.__class;
            var arr = Pool[key] || (Pool[key] = []);
            arr.push(obj);
        }
    }
    Pool.dr = {};
    badyoo.registerClass(Pool,"Pool");

    class Handler
    {
        run()
        {
            if( this.callback == null ) return;
            var r = null;
            if( arguments.length ) r = this.callback.apply(this.pointer, this.args ? this.args.concat(arguments) : arguments );
            else r = this.callback.apply(this.pointer, this.args);
            if( this.one ) this.free(true);
            return r;
        }
        
        free(pool = false)
        {
            this.args = this.callback = this.pointer = null;
            if( pool )  Pool.set(Handler,this);
        }

        static create(pointer,callback,args,one = true)
        {
            var h = Pool.get(Handler);
            h.pointer = pointer;
            h.callback = callback;
            h.args = args;
            h.one = one;
            return h;
        }
    }
    badyoo.registerClass(Handler,"Handler");

    class BlendMode
    {
        static b0(gl)
        {
           gl.blendFunc(gl.ONE,gl.ZERO);
        }
        static b1(gl)
        {
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        }
        static b2(gl)
        {
            gl.blendFunc(gl.ONE,gl.DST_ALPHA);
        }
        static b3(gl)
        {
            gl.blendFunc(gl.DST_COLOR,gl.ONE_MINUS_SRC_ALPHA);
        }
        static b4(gl)
        {
            gl.blendFunc(gl.ONE, gl.ONE);
        }
        static b5(gl)
        {
            gl.blendFunc(gl.ZERO, gl.ZERO);
        }
    }
    BlendMode.NONE = 0;
    BlendMode.NORMAL = 1;
    BlendMode.ADD = 2;
    BlendMode.MULTIPLY = 3;
    BlendMode.SCREEN = 4;
    BlendMode.ERASE = 5;
    badyoo.registerClass(BlendMode,"BlendMode");

    class GameObject
    {
        constructor()
        {
            this.x = 0;
            this.y = 0;
            this.width = 0;
            this.height = 0;
            this.alpha = 1;
            this.m_pivotX = 0;
            this.m_pivotY = 0;
            this.m_rotation = 0;
            this.m_scaleX = 1;
            this.m_scaleY = 1;
            this.visible = true;
            this.blendMode = BlendMode.NORMAL;
            this.parent = null;
            this.matrix = Pool.get(Matrix);
        }

        pivot(x,y)
        {
            if( this.m_pivotX != x || this.m_pivotY != y  )
            {
                this.m_pivotX = x;
                this.m_pivotY = y;
                this.updateMatrix();
            }
        }
        getPivotX()
        {
            return this.m_pivotX;
        }
        getPivotY()
        {
            return this.m_pivotY;
        }

        scale(x,y)
        {
            if( this.m_scaleX != x || this.m_scaleY != y  )
            {
                this.m_scaleX = x;
                this.m_scaleY = y;
                this.updateMatrix();
            }
        }
        getScaleX()
        {
            return this.m_scaleX;
        }
        getScaleY()
        {
            return this.m_scaleY;
        }

        set rotation(v)
        {
            if( this.m_rotation != v )
            {
                this.m_rotation = v;
                this.updateMatrix();
            }
        }
        get rotation()
        {
            return this.m_rotation;
        }

        updateMatrix()
        {
            var r = this.m_rotation;
            if( r == 0 )
            {
                this.matrix.set(
                    this.m_scaleX, 0.0, 0.0, this.m_scaleY, 
                    this.m_scaleX * this.m_pivotX,this.m_scaleY* this.m_pivotY
                );
            }
            else
            {
                r =  (360 - r) % 360;
                if( r < 0 ) r += 360;

                var cos = Maths.cos[r];
                var sin = Maths.sin[r];
                this.matrix.a = this.m_scaleX *  cos;
                this.matrix.b = this.m_scaleX *  -sin;
                this.matrix.c = this.m_scaleY *  sin;
                this.matrix.d = this.m_scaleY *  cos;
                this.matrix.tx = this.m_pivotX * this.matrix.a - this.m_pivotY * this.matrix.c;
                this.matrix.ty = this.m_pivotX * this.matrix.b - this.m_pivotY * this.matrix.d;
            }
        }

        move(x,y)
		{
			this.x = x;
			this.y = y;
		}
        free(){}
    }
    badyoo.registerClass(GameObject,"GameObject");

    class Loader
    {
        constructor()
        {
            this.url = "";
            this.type = "";
            this.handler = null;
        }

        load(url,handler)
        {
            var self = this;
            self.url = url;
            self.handler = handler;
            var image = new window.Image();
            image.src = this.url;
            image.crossOrigin = "";
            image.onload = function()
            {
                image.onerror = image.onload = null;
                self.onloaded(image);
            }
            image.onerror = function()
            {
                image.onerror = image.onload = null;
                self.onloaded(null);
            }
        }

        onloaded(data)
        {
            if( data )
            {
                var texture = new Texture(data);
                texture.url = this.url;
                Loader.assets[this.url] = texture;
               
                if( this.handler.length != null )
                {
                    var len = this.handler.length;
                    for( var i = 0;i<len;i++ )
                    {
                        this.handler[i].run(texture);
                    }
                    this.handler.length = 0;
                }
                else
                {
                    this.handler.run(texture);
                }
                this.handler = null;
                this.url = "";
                this.type = "";
                Pool.set(Loader,this);
                delete Loader.pool[this.url];
            }
            else
            {
                console.log("load error url:"+this.url);
            }
        }

        static load(url,handler)
        {
           
           var loader = Loader.pool[url];
           if( loader )
           {
                if( loader.handler instanceof Array )
                {
                    loader.handler.push(handler);
                }
                else
                {
                    loader.handler = [loader.handler,handler];
                }
           }
           else
           {
                loader = Loader.pool[url] = Pool.get(Loader);
                loader.load(url,handler);
           }
        
           
        }
        static getRES(url)
        {
            return Loader.pool[url];
        }
    }
    Loader.pool = {};
    Loader.assets = {};
    badyoo.registerClass(Loader,"Loader");

    class Texture
    {
        constructor(data)
        {
            this.width = data.width;
            this.height = data.height;
            this.u = 1;
            this.v = 1;
            this.tex = badyoo.current.uploadTexture(data);
        }
    }
    badyoo.registerClass(Texture,"Texture");

    class Layer extends GameObject
    {
        constructor()
        {
            super();
            this.displayList = [];
            this.displayNum = 0;
        }

        Instantiate(cla)
        {
            var o = new cla;
            if( o instanceof GameObject )
            {
                this.addChild(o);
            }
            return o;
        }

        get numChildren()
        {
            return this.displayNum;
        }

        contains(o)
		{
			return this.displayList.indexOf( o ) != -1;
		}

        addChild(o)
        {
            this.addChildAt(o,this.displayNum);
        }
        
        addChildAt(o,index)
		{
            if ( index >= 0 && index <= this.displayNum )
			{
				if ( o.parent == this )
				{
					this.setChildIndex(o,index); 
				}
				else
				{
					if ( index == this.displayNum ) 
					{
						this.displayList[this.displayNum++] = o;
					}
					else     
					{
						this.displayList.splice(index, 0, o);
					}
				}
				o.parent = this;
            }
            else
            {
                throw new RangeError("Invalid child index");
            }
        }

        removeChild(o)
        {
            var index = this.displayList.indexOf(o);
            if(index != -1) 
            {
                this.displayList.splice(index,1)
                this.displayNum--;
                o.parent = null;
            }
        }

        removeChildAt(index)
        {
            if( index >= 0 && index < this.displayNum )
			{
                var o = this.displayList[index]
                this.displayList.splice(index,1)
                this.displayNum--;
                o.parent = null;
            }
        }

        removeAllChild(beginIndex=0, endIndex=-1)
        {
            if ( endIndex < 0 || endIndex >= this.displayNum ) endIndex = this.displayNum - 1;
            for ( var i = beginIndex; i <= endIndex; i++  )this.removeChildAt(beginIndex);
        }

        getChildAt( index )
		{
            if ( index >= 0 && index < this.displayNum )
				return this.displayList[index];
			else
				throw new Error("Invalid child index");
        }

        getChildByName(name)
		{
			for ( var i=0; i<this.displayNum; i++ )
				if ( this.displayList[i].name == name ) return this.displayList[i];
			
			return null;
		}

        getChildIndex(o)
        {
           return this.displayList.indexOf(o);
        }

        setChildIndex(o,index)
        {
            var oldIndex = this.displayList.indexOf(o);
			if ( oldIndex == index ) return;
			if ( oldIndex == -1 ) throw new Error("Not a child of this layer");
			this.displayList.splice( oldIndex, 1 );
			this.displayList.splice( index, 0, o );

        }
    }
    badyoo.registerClass(Layer,"Layer");

    class Image extends GameObject
    {
        constructor()
        {
            super();
        }
        set skin(v)
        {
            this.m_skin = v;
            Loader.load(this.m_skin,Handler.create(this,this.skinLoaded))
        }

        get skin()
        {
            return this.m_skin;
        }

        skinLoaded(v)
        {
            if( v.url == this.m_skin ) this.texture = v;
        }

        set texture(v)
        {
            this.m_texture = v;
        }

        get texture()
        {
            return this.m_texture;
        }

        get width()
        {
            return this.m_width || (this.m_texture && this.m_texture.width);
        }
        set width(v)
        {
            this.m_width = v;
        }

        get height()
        {
            return this.m_height || (this.m_texture && this.m_texture.height);
        }
        set height(v)
        {
            this.m_height = v;
        }
    }
    badyoo.registerClass(Image,"Image");

    class Lable extends GameObject
    {

    }
    badyoo.registerClass(Lable,"Lable");

    class Background extends GameObject
    {

    }
    badyoo.registerClass(Background,"Background");

    badyoo.current = new badyoo["BYGL"]();
    badyoo["init"] = function(w,h,ac = true,c = null,r = null)
    {
        badyoo.current.init(w,h,r,ac,c);
    };
    badyoo["bgColor"] = function( color )
    {
        badyoo.current.G_a = ((color >> 24) & 0xff) / 255.0;
        badyoo.current.G_r = ((color >> 16) & 0xff) / 255.0;
        badyoo.current.G_g = ((color >> 8) & 0xff) / 255.0;
        badyoo.current.G_b = (color & 0xff) / 255.0;
    }
    badyoo["Instantiate"] = function(cla)
    {
        var o = new cla;
        if( o instanceof GameObject )
        {
            badyoo.current.root["addChild"](o);
        }
        return o;
    }


}(window));