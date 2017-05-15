(function(window)
{
    'use strict';
    var badyoo = {};
    window.badyoo = badyoo;

    class Shader
    {
        constructor(vs,ps)
        {
            this.index = 0;
            this.Uindex = 0;
            this.program = badyoo.current.createProgram(vs,ps);
        }

        AttribLocation(v)
        {
            this["a_"+this.index++] = badyoo.current.gl.getAttribLocation(this.program,v);
        }

        AttriUniformLocation(v,num)
        {
            this["u_"+this.Uindex++] = 
            [
                badyoo.current.gl.getUniformLocation(this.program,v),
                num
            ];
        }

        uploadAttrib(index,size,type,normalize = false,stride = 0,offset = 0)
        {
            badyoo.current.gl.enableVertexAttribArray(this["a_"+index]);
            badyoo.current.gl.vertexAttribPointer(this["a_"+index], size, type, normalize, stride, offset);
        }

        upload()
        {
            var num = 0;
            for( var i = 0;i<this.Uindex;i++ )
            {
                var uniform = this["u_"+i];
                if( uniform[1] == 2 )
                {
                    badyoo.current.gl.uniform2f(uniform[0],arguments[num],arguments[num+1]);
                    num+=2;
                }
                else
                {
                    badyoo.current.gl.uniform1f(uniform[0],arguments[num]);
                    num++;
                }
            }
           
        }
    }

    class BYGL
    {
        constructor()
        {
            this.debug = true;
            this.displayList = [];
            this.randerList = [];
            this.G_a = this.G_r = this.G_g = this.G_b = 0;
        }        
        init(width,height,canvas)
        {
            var self = this; 
            self.window = window;
            self.canvas = canvas;
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
                vec2 temp = a_position.xy/u_re * 2.0;
                gl_Position = vec4(temp.x,-temp.y,0,1);
            }`;
            var fs = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_texture;
            void main(){
                gl_FragColor = texture2D(u_texture, v_texCoord);
                //gl_FragColor = vec4(0.5,0.5,0.5,0.5);

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
            shader.AttriUniformLocation("u_re",2);
            shader.AttriUniformLocation("u_alpha",1);
            this.spriteAProgram = shader;
            var shader = new Shader(vs,fs);
            shader.AttribLocation("a_position");
            shader.AttriUniformLocation("u_re",2);
            this.spriteProgram = shader;
            this.indexBuffer = this.createIndexBuffer(65536/4);
            for( var i = -720;i<=720;i++ )
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
                //console.log( t -self.time);
                self.time = t;
                self.update();
                w.requestAnimationFrame(update);
                console.log(self.batch);
            }
        }

        createIndexBuffer(num)
        {
            //Indexbuffer webgl1.0 只支持16位uint
            if( num  > 16384 ) num = 16384;
            var self = this;
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
            this.resetRender();
            //清除画布
            this.gl.clearColor(this.G_r, this.G_g, this.G_b, this.G_a);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            this.transform(this.displayList);
            this.randerList.push([this.drawNum,this.drawStart,this.G_texture,this.G_NBlendMode,this.G_alpha]);
            this.drawNum = 0;
            //顶点缓冲区
            var positionBuffer = this.positionBuffer;
            if( positionBuffer == null ) this.positionBuffer = positionBuffer = this.gl.createBuffer();
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer)
            this.gl.bufferData(this.gl.ARRAY_BUFFER,new Float32Array(this.posionList),this.gl.STATIC_DRAW);
       
             for( var i = 0;i<this.randerList.length;i++ )
            {
                this.render(this.randerList[i]);
            }
            
        }

        transform(list)
        {
            var self = this;
            var arr = self.posionList || (self.posionList = []);
            var len = list.length;
            self.index = 0;
            for( var i = 0;i<len;i++ )
            {
                var gameObect = list[i];
                gameObect.rotation +=1;
                if( gameObect.m_texture && gameObect.visible && gameObect.alpha !== 0 )
                {
                    if( (self.G_texture != null && self.G_texture != gameObect.m_texture.tex )
                        || (  self.G_blendMode != null && gameObect.blendMode != self.G_blendMode )
                        || ( gameObect.alpha != self.G_alpha ))
                    {
                        self.randerList.push([self.drawNum,self.drawStart,self.G_texture,self.G_NBlendMode,self.G_alpha]);
                        self.drawStart = i*12;
                        self.drawNum = 0;
                    }

                    self.G_texture = gameObect.m_texture.tex;
                    self.G_NBlendMode = gameObect.blendMode;
                    self.G_alpha = gameObect.alpha;

                    var tx = gameObect.x;
                    var ty = gameObect.y;
                    var w = gameObect.width * gameObect.scaleX;
                    var h = gameObect.height * gameObect.scaleY;
                    var wa = w;
                    var wd = 0;
                    var ha = 0;
                    var hd = h;
                    var r = gameObect.rotation;
                    if( r != 0 )
                    {
                        var c = Maths.cos[r];
                        var s = Maths.sin[r];
                        wa = w * c;
                        wd = -w * s;
                        ha = h * s;
                        hd = h * c;
                    }
                    
                    arr[this.index++] = tx;
                    arr[this.index++] = ty;
                    arr[this.index++] = 0;
                    arr[this.index++] = 0;

                    arr[this.index++] = tx+wa;
                    arr[this.index++] = ty+wd;
                    arr[this.index++] = 1;
                    arr[this.index++] = 0;

                    arr[this.index++] = tx+ha;
                    arr[this.index++] = ty+hd;
                    arr[this.index++] = 0;
                    arr[this.index++] = 1;

                    arr[this.index++] = tx+wa+ha;
                    arr[this.index++] = ty+wd+hd;
                    arr[this.index++] = 1;
                    arr[this.index++] = 1;
                    this.drawNum+=6;
                }
            }
        }

        resetRender()
        {
            this.randerList.length = 0;
            this.G_texture = null;
            this.G_program = null;
            this.G_alpha = 1;
            this.batch = 0;
            this.drawNum = 0;
            this.drawStart = 0;
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

            var shader = self.spriteProgram;
            if( self.G_alpha != 1 ) shader = self.spriteAProgram;
            self.gl.useProgram(shader.program);
            shader.upload(self.gl.canvas.width,self.gl.canvas.height,self.G_alpha);
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
    badyoo.BYGL = BYGL;

    class Maths
    {
        static random(start,end)
        {
            return ( Math.random() * (end - start) | 0 ) + start;
        }
    }
    Maths.cos ={};
    Maths.sin ={};

    badyoo.Math = Maths;

    class Pool
    {
        static get(_clas)
        {
            var arr = Pool[_clas] || (Pool[_clas] = []);
            var obj = Pool[_clas].shift();
            if( obj == null ) return new _clas();
            return obj;
        }

        static set(_clas,obj)
        {
            var arr = Pool[_clas] || (Pool[_clas] = []);
            arr.push(obj);
        }
    }
    Pool.dr = {};
    badyoo.Pool = Pool;

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
    badyoo.Handler = Handler;

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
    badyoo.BlendMode = BlendMode;

    class GameObject
    {
        constructor()
        {
            this.x = 0;
            this.y = 0;
            this.pivotX = 0;
            this.pivotY = 0;
            this.width = 0;
            this.height = 0;
            this.alpha = 1;
            this.scaleX = 1;
            this.scaleY = 1;
            this.visible = true;
            this.rotation = 0;
            this.blendMode = BlendMode.NORMAL;
            badyoo.current.displayList.push(this);
        }
        free(){}
    }
    badyoo.GameObject = GameObject;

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
    badyoo.Loader = Loader;

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
    badyoo.Texture = Texture;

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
            if( this.m_width ) return this.m_width;
            else if( this.m_texture ) return this.m_texture.width;
            return 0;
        }
        set width(v)
        {
            this.m_width = v;
        }

        get height()
        {
            if( this.m_height ) return this.m_height;
            else if( this.m_texture ) return this.m_texture.height;
            return 0;
        }
        set height(v)
        {
            this.m_height = v;
        }
    }
    badyoo.Image = Image;

    badyoo.current = new badyoo.BYGL();
    badyoo.init = function(w,h,c){badyoo.current.init(w,h,c)};
    badyoo.bgColor = function( color )
    {
        badyoo.current.G_a = ((color >> 24) & 0xff) / 255.0;
        badyoo.current.G_r = ((color >> 16) & 0xff) / 255.0;
        badyoo.current.G_g = ((color >> 8) & 0xff) / 255.0;
        badyoo.current.G_b = (color & 0xff) / 255.0;
    }

}(window));