(function(window)
{
    'use strict';
    var badyoo = {};
    window.badyoo = badyoo;
    class BYGL
    {
        constructor()
        {
            this.debug = true;
            this.displayList = [];
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

            self.canvas.width = self.width ? self.width : window.innerWidth;
            self.canvas.height = self.height ? self.height : window.innerHeight;

            self.gl = self.canvas.getContext("webgl");
            if( !self.gl ) 
            {
                console.error("webgl Not Supported!");
                return;
            }

            var vs = `
            attribute vec4 a_position;
            uniform vec2 u_re;
            varying vec2 v_texCoord;
            void main() {
                v_texCoord = a_position.zw;
                gl_Position = vec4(a_position.xy/u_re * 2.0,0,1);
            }`;
            var fs = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_texture;
            void main(){
                gl_FragColor = texture2D(u_texture, v_texCoord);
            }`
            ;

            var program = self.createProgram(self.createShader(self.gl.VERTEX_SHADER,vs),self.createShader(self.gl.FRAGMENT_SHADER,fs));
            self.spriteProgram =
            {
                p:program,
                posion:self.gl.getAttribLocation(program, "a_position"),
                re:self.gl.getUniformLocation(program, "u_re")
            }

            var w = window;
            w.requestAnimationFrame = w.requestAnimationFrame || w.webkitRequestAnimationFrame || w.mozRequestAnimationFrame || w.oRequestAnimationFrame || w.msRequestAnimationFrame;
            w.requestAnimationFrame(update);
            function update(v)
            {
                //var t = Date.now();
                self.update();
                //console.log( Date.now() - t );
                w.requestAnimationFrame(update);
            }
        }

        createShader(type, source) 
        {
            var shader = this.gl.createShader(type);
            this.gl.shaderSource(shader, source);
            this.gl.compileShader(shader);

            var success = this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS);
            if (success) return shader;

            if( this.debug ) console.log(this.gl.getShaderInfoLog(shader));

            this.gl.deleteShader(shader);
        }

        createProgram(vertexShader, fragmentShader) {
            var program = this.gl.createProgram();
            this.gl.attachShader(program, vertexShader);
            this.gl.attachShader(program, fragmentShader);
            this.gl.linkProgram(program);
            var success = this.gl.getProgramParameter(program, this.gl.LINK_STATUS);
            if (success) return program;
            if( this.debug ) console.log(this.gl.getProgramInfoLog(program));
            this.gl.deleteProgram(program);
        }

        uploadTexture(img)
        {
            var gl = this.gl;
            var texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            // 非二次幂
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            // 上传
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            return texture;
        }

        update()
        {
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

                    indices[this.index2++] = this.index3;
                    indices[this.index2++] = this.index3+1;
                    indices[this.index2++] = this.index3+2;
                    indices[this.index2++] = this.index3+2;
                    indices[this.index2++] = this.index3+1;
                    indices[this.index2++] = this.index3+3;

                    this.index3 +=4;
                }
            }
        }

        render()
        {
            var self = this;
            //顶点缓冲区
            var positionBuffer = self.positionBuffer;
            if( positionBuffer == null ) self.positionBuffer = positionBuffer = self.gl.createBuffer();
            self.gl.bindBuffer(self.gl.ARRAY_BUFFER, positionBuffer)
            self.gl.bufferData(self.gl.ARRAY_BUFFER,new Float32Array(self.posionList),self.gl.STATIC_DRAW);

            //创建顶点索引缓冲区
            var indexBuffer = self.indexBuffer;
            if( indexBuffer == null ) self.indexBuffer = indexBuffer = self.gl.createBuffer();
            self.gl.bindBuffer(self.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            self.gl.bufferData(self.gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(self.indices),self.gl.STATIC_DRAW);

            var program = self.spriteProgram.p;
            self.gl.useProgram(program);
            self.gl.enableVertexAttribArray(self.spriteProgram.posion);
            self.gl.vertexAttribPointer(self.spriteProgram.posion, 4, self.gl.FLOAT, false, 0, 0);
            self.gl.uniform2f(self.spriteProgram.re, self.gl.canvas.width, self.gl.canvas.height);
            self.gl.drawElements(self.gl.TRIANGLES,self.indices.length,self.gl.UNSIGNED_SHORT, 0);

            self.indices.length = 0;self.posionList.length = 0;
            self.index = 0;self.index2 = 0;self.index3 = 0;
        }
    }
    badyoo.BYGL = BYGL;

    class Maths
    {
        static range(start,end)
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
            if( pool )  badyoo.Pool.set(Handler,this);
        }

        static create(pointer,callback,args,one = true)
        {
            var h = badyoo.Pool.get(Handler);
            h.pointer = pointer;
            h.callback = callback;
            h.args = args;
            h.one = one;
            return h;
        }
    }
    badyoo.Handler = Handler;

    class GameObject
    {
        constructor()
        {
            this.x = 0;
            this.y = 0;
            this.width = 0;
            this.height = 0;
            this.alpha = 1;
            this.scaleX = 1;
            this.scaleY = 1;
            this.rotate = 0;
            this.visible = true;

            badyoo.current.displayList.push(this);
        }
    }
    badyoo.GameObject = GameObject;

    class Loader
    {
        constructor()
        {
            this.url = "";
            this.type = "";
            this.handler = [];
        }

        load(url,handler)
        {
            var self = this;
            self.url = url;
            self.handler.push(handler);
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
                Loader.pool[this.url] = texture;
                var len = this.handler.length;
                if( len )
                {
                    for( var i = 0;i<len;i++ )
                    {
                        this.handler[i].run(texture);
                    }
                    this.handler.length = 0;
                }
            }
            else
            {
                console.log("load error url:"+this.url);
            }
        }

        static load(url,handler)
        {
           var loader =  badyoo.Pool.get(Loader);
           loader.load(url,handler);
        }
        static getRES(url)
        {
            return Loader.pool[url];
        }
    }
    Loader.pool = {};
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
            this.url = data.src;
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
            // if( v.url == this.m_skin ) 
            this.texture = v;
        }

        set texture(v)
        {
            this.width = v.width;
            this.height = v.height;
            this.m_texture = v;
        }

        get texture()
        {
            return this.m_texture;
        }
    }
    badyoo.Image = Image;

    badyoo.current = new badyoo.BYGL();
    badyoo.init = function(w,h,c)
    {
        badyoo.current.init(w,h,c);
    }

}(window));