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
            this.time = 0;
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

            self.gl = self.canvas.getContext("webgl");
            if( !self.gl ) 
            {
                console.error("webgl Not Supported!");
                return;
            }
            console.warn("init w:"+self.width+" h:"+self.height);


            var vs = `
            attribute vec4 a_position;
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

            self.gl.enable(self.gl.BLEND);
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
            this.gl.clearColor(0, 0, 0, 0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            this.transform(this.displayList);
            this.render();
        }

        transform(list)
        {
            var self = this;
            var arr = this.posionList || (this.posionList = []);
            var len = list.length;
            var indices = this.indices || (this.indices = []);
            this.index = 0;
            this.index2 = 0;
            this.index3 = 0;

            for( var i = 0;i<len;i++ )
            {
                var gameObect = list[i];
                if( gameObect.m_texture && gameObect.visible && gameObect.alpha !== 0 )
                {

                    if( (this.G_texture != null && this.G_texture != gameObect.m_texture.tex )
                        || ( this.G_blendMode != null && gameObect.blendMode != this.G_blendMode )
                        || ( gameObect.alpha != this.G_alpha ))
                    {
                        this.render();
                    }

                    this.G_texture = gameObect.m_texture.tex;
                    this.G_blendMode = gameObect.blendMode;
                    this.G_alpha = gameObect.alpha;
                    
                    arr[this.index++] = gameObect.x;
                    arr[this.index++] = gameObect.y;
                    arr[this.index++] = 0;
                    arr[this.index++] = 0;

                    arr[this.index++] = gameObect.x+gameObect.width;
                    arr[this.index++] = gameObect.y;
                    arr[this.index++] = 1;
                    arr[this.index++] = 0;

                    arr[this.index++] = gameObect.x;
                    arr[this.index++] = gameObect.y+gameObect.height;
                    arr[this.index++] = 0;
                    arr[this.index++] = 1;

                    arr[this.index++] = gameObect.x+gameObect.width;
                    arr[this.index++] = gameObect.y+gameObect.height;
                    arr[this.index++] = 1;
                    arr[this.index++] = 1;

                    indices[this.index2++] = this.index3+0;
                    indices[this.index2++] = this.index3+1;
                    indices[this.index2++] = this.index3+2;
                    indices[this.index2++] = this.index3+2;
                    indices[this.index2++] = this.index3+1;
                    indices[this.index2++] = this.index3+3;

                    this.index3 +=4;
                }
            }
        }

        resetRender()
        {
            this.G_texture = null;
            this.G_program = null;
            this.G_blendMode = null;
            this.G_alpha = 1;
            this.batch = 0;
        }

        render()
        {
            var self = this;
            //混合模式
            if( self.G_blendMode == BlendMode.NONE ) self.gl.blendFunc(self.gl.ONE, self.gl.ZERO);
            if( self.G_blendMode == BlendMode.NORMAL ) self.gl.blendFunc(self.gl.ONE, self.gl.ONE_MINUS_SRC_ALPHA);
            if( self.G_blendMode == BlendMode.ADD ) self.gl.blendFunc(self.gl.ONE, self.gl.DST_ALPHA);
            if( self.G_blendMode == BlendMode.MULTIPLY ) self.gl.blendFunc(self.gl.DST_COLOR, self.gl.ONE_MINUS_SRC_ALPHA);
            if( self.G_blendMode == BlendMode.SCREEN ) self.gl.blendFunc(self.gl.ONE, self.gl.ONE);
            if( self.G_blendMode == BlendMode.ERASE ) self.gl.blendFunc(self.gl.ZERO, self.gl.ZERO);

            var shader = self.spriteProgram;
            if( self.G_alpha != 1 ) shader = self.spriteAProgram;
            self.gl.useProgram(shader.program);
            shader.upload(self.gl.canvas.width,self.gl.canvas.height,self.G_alpha);
            //顶点缓冲区
            var positionBuffer = self.positionBuffer;
            if( positionBuffer == null ) self.positionBuffer = positionBuffer = self.gl.createBuffer();
            self.gl.bindBuffer(self.gl.ARRAY_BUFFER, positionBuffer)
            self.gl.bufferData(self.gl.ARRAY_BUFFER,new Float32Array(self.posionList),self.gl.STATIC_DRAW);
            shader.uploadAttrib(0,4,self.gl.FLOAT);
            //创建顶点索引缓冲区
            var indexBuffer = self.indexBuffer;
            if( indexBuffer == null ) self.indexBuffer = indexBuffer = self.gl.createBuffer();
            self.gl.bindBuffer(self.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            self.gl.bufferData(self.gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(self.indices),self.gl.STATIC_DRAW);
            //纹理
            self.gl.bindTexture(self.gl.TEXTURE_2D,this.G_texture);
            //绘制
            self.gl.drawElements(self.gl.TRIANGLES,self.indices.length,self.gl.UNSIGNED_SHORT, 0);

            self.indices.length = 0;self.posionList.length = 0;
            self.index = 0;self.index2 = 0;self.index3 = 0;
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
            this.rotate = 0;
            this.visible = true;
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

}(window));