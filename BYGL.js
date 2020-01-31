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
            this.tList = [];
            this.G_a = this.G_r = this.G_g = this.G_b = 0;
            this.G_m = new Matrix();
        }        
        init(width,height,root,alignC,canvas)
        {
            var self = this;
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
            if( root == null ) self.root = new Layer();
            else self.root = new root();

            self.root.width = self.width;
            self.root.height = self.height;
            badyoo.root = self.root;

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
                //vec4 temp = texture2D(u_texture, v_texCoord);
                //float l = 0.299*temp.r+0.587*temp.g+0.114*temp.b;
                //gl_FragColor = vec4(l,l,l,temp.a);
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
            var quadNum = 16384;
            self.indexBuffer = self.createIndexBuffer(quadNum);
            self.posionList = new Float32Array(new ArrayBuffer(quadNum*4*16));
            for( var i = 0;i<=360;i++ )
            {
                var a = i * Math.PI / 180;
                Maths.sin[i] = Number(Math.sin(a).toFixed(8));
                Maths.cos[i] = Number(Math.cos(a).toFixed(8));
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
                //console.log(self.batch);
            }

            self.tListType = {
                "mousedown":"onTouchDown",
                "mouseup":"onTouchUp",
                "mouseout":"onTouchOut",
                "mousemove":"onTouchMove",
                "touchstart":"onTouchDown",
                "touchend":"onTouchUp",
                "touchcancel":"onTouchOut",
                "touchmove":"onTouchMove"
            };
            for( var str in self.tListType ) self.canvas.addEventListener(str,mouse);

            function mouse(e)
            {
                  if( e.changedTouches )
                  {
                      var arr = e.changedTouches;
                      for( var i = 0;i<arr.length;i++ )
                      {
                        var touch = arr[i];
                        touch.type = e.type;
                        self.tList.push(touch);
                      }
                  }
                  else
                  {
                    self.tList.push(e);
                  }
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

        onTouch()
        {
            var len = this.tList.length;
            for( var i = 0;i<len;i++ )
            {
                var e = this.tList[i];
                var touchID = e.identifier || 0;
                var touchX = e.pageX || e.clientX;
                var touchY = e.pageY || e.clientY;

                if( this.alignC ) touchX -= this.width>>1,touchY -= this.height>>1;
                    
                this.touchEvent(this.root,touchX,touchY,touchID,this.tListType[e.type]);
            }

            this.tList.length = 0;
            
        }

        touchEvent(layer,x,y,touchID,type)
        {
            var point = Pool.get(Point);
            var self = this;
            var touchMatrix = Pool.get(Matrix);
            var list = layer.displayList;
            var len = layer.displayNum;

            point.x = x;
            point.y = y;
            layer.fromParentPoint(point);

            if( layer.visible == false && layer.touchEnabled == false )
            {
                return false;
            }

            for( var i = len - 1;i>=0;i-- )
            {
                var gameObect = list[i];
                if( self.touchEvent( gameObect,point.x,point.y,touchID,type ) ) break;
            }
            if( point.x >= 0 && point.x <= layer.width && point.y >=0 && point.y<= layer.height )
            {
                if( layer[type] )
                {
                    layer[type].call(layer,x,y,touchID);
                    return true;
                }
            }

            
        }

        updateSprite()
        {
            var t = Date.now();
            for( var i = 0,len = Sprite.pool.length;i<len;i++ )
            {
                var sp = Sprite.pool[i];
                if( sp.loaded && sp.m_stop == false )
                {
                    var nextFrame = (t - sp.lastTime) / sp.interval | 0;
                    if( nextFrame )
                    {
                        sp.gotoAndPlay(sp.currentFrame+nextFrame);
                    }
                   
                }
            }
        }

        update()
        {
            var self = this;
            self.updateSprite();
            self.onTouch();
            Loop.m_loop();
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
            self.gl.bufferData(self.gl.ARRAY_BUFFER,self.posionList,self.gl.STATIC_DRAW);
            self.spriteAProgram.bind();
            self.spriteAProgram.uploadAttrib(0,4,self.gl.FLOAT);
            self.spriteProgram.bind();
            self.spriteProgram.uploadAttrib(0,4,self.gl.FLOAT);
            
            //顶点索引缓冲区
            self.gl.bindBuffer(self.gl.ELEMENT_ARRAY_BUFFER,self.indexBuffer);
             for( var i = 0;i<self.randerList.length;i++ )
            {
                self.render(self.randerList[i]);
            }
            
        }

        transform(layer,alpha,matrix)
        {
            var self = this;
            var arr = self.posionList;
            var list = layer.displayList;
            var len = layer.displayNum;
            var alpha = layer.alpha * alpha;
            for( var i = 0;i<len;i++ )
            {
                var gameObect = list[i];
                var oA = gameObect.alpha * alpha;
                var tempMatrix = gameObect.matrix;
                var childMatrix = Pool.get(Matrix);
                childMatrix.set(
					matrix.a * tempMatrix.a + matrix.c * tempMatrix.b,
					matrix.b * tempMatrix.a + matrix.d * tempMatrix.b,
					matrix.a * tempMatrix.c + matrix.c * tempMatrix.d,
					matrix.b * tempMatrix.c + matrix.d * tempMatrix.d,
					matrix.tx + matrix.a * tempMatrix.tx + matrix.c * tempMatrix.ty,
					matrix.ty + matrix.b * tempMatrix.tx + matrix.d * tempMatrix.ty
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
                            arr[this.index++] = gameObect.m_texture.uv[0]; //u 
                            arr[this.index++] = gameObect.m_texture.uv[1];  //v
                           
                            arr[this.index++] = tx+wa;
                            arr[this.index++] = ty+wb;
                            arr[this.index++] = gameObect.m_texture.uv[2]; //u2
                            arr[this.index++] = gameObect.m_texture.uv[3]; //v
                            
                            arr[this.index++] = tx+hc;
                            arr[this.index++] = ty+hd;
                            arr[this.index++] = gameObect.m_texture.uv[4]; //u
                            arr[this.index++] = gameObect.m_texture.uv[5]; //v2

                            arr[this.index++] = tx+wa+hc;
                            arr[this.index++] = ty+wb+hd;

                            arr[this.index++] = gameObect.m_texture.uv[6]; //u2
                            arr[this.index++] = gameObect.m_texture.uv[7]; //v2

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
            //纹理
            self.gl.bindTexture(self.gl.TEXTURE_2D,this.G_texture);
            //绘制
            self.gl.drawElements(self.gl.TRIANGLES,arr[0],self.gl.UNSIGNED_SHORT, arr[1]);
            self.batch ++;
        }
    }
    badyoo.registerClass(BYGL,"BYGL");

    class Point
    {
        constructor(x = 0,y = 0)
        {
            this.x = x;
            this.y = y;
        }
        setTo(x,y)
        {
            this.x = x;
            this.y = y;
        }
    }
    badyoo.registerClass(Point,"Point");

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
        invert(){
             var a = this.a;
             var b = this.b;
             var c = this.c;
             var d = this.d;
             var tx = this.tx;
             var i = a * d - b * c;
     
             this.a = d / i;
             this.b = -b / i;
             this.c = -c / i;
             this.d = a / i;
             this.tx = (c * this.ty - d * tx) / i;
             this.ty = -(a * this.ty - b * tx) / i;
             return this;
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
            var arr = Pool.dr[key] || (Pool.dr[key] = []);
            var obj = arr.shift();
            if( obj == null ) return new cla();
            return obj;
        }

        static set(cla,obj)
        {
            var key = cla.__class;
            var arr = Pool.dr[key] || (Pool.dr[key] = []);
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

    class LoopData
    {
        constructor()
        {
            this.arr = [];
            this.num = 0;
        }
        free()
        {
            delete Loop.updateDir[this.pointer.BadyooLoopIdx];
            this.pointer.BadyooLoopIdx = null;
            this.pointer = null;
            this.num = 0;
            this.arr.length = 0;
            Pool.set(LoopData,this);
        }
    }
    badyoo.registerClass(LoopData,"LoopData");
    class Loop
    {
        static update(pointer,callback)
        {
            var id = pointer.BadyooLoopIdx;
            var loopData;
            if( id == null  )
            {
                loopData = Pool.get(LoopData);
                loopData.pointer = pointer;
                pointer.BadyooLoopIdx = Loop.loopIdx++;
                Loop.updateDir[pointer.BadyooLoopIdx] = Loop.updateList[Loop.updateNum] = loopData;
                Loop.updateNum++;
            } 
            loopData = Loop.updateDir[pointer.BadyooLoopIdx];
            if( loopData.arr.indexOf(callback) == -1 )
            {
                loopData.arr.push(callback);
                loopData.num ++;
            } 
        }

        static m_loop()
        {
            for( var i = 0;i<Loop.updateNum;i++ )
            { 
                var loopData = Loop.updateList[i];
                var len = loopData.arr.length;
                if( loopData.num == 0 )
                {
                    loopData.free();
                    Loop.updateList.splice(i,1);
                    Loop.updateNum--;
                    i--

                    continue;
                }

                for( var j = 0;j<len;j++ )
                {
                    if( loopData.arr[j] == 0 )
                    {
                        loopData.arr.splice(j,1);
                        len--;
                        j--;
                    }
                    else
                    {
                        loopData.arr[j].call(loopData.pointer);
                    }
                }
            }
        }

        static clearUpdate(pointer,callback)
        {
            var id = pointer.BadyooLoopIdx;
            if( id != null  )
            {
                var loopData = Loop.updateDir[pointer.BadyooLoopIdx];
                var removeIndex = loopData.arr.indexOf(callback);
                if( removeIndex != -1 )
                {
                    loopData.arr.splice(removeIndex,1,0);
                    loopData.num--;
                }
            }
        }

        static clearAll(pointer)
        {
            var id = pointer.BadyooLoopIdx;
            if( id != null  )
            {
                var loopData = Loop.updateDir[pointer.BadyooLoopIdx];
                var removeIndex = Loop.updateList.indexOf(loopData);
                if( removeIndex != -1 )
                {
                    loopData.free();
                    Loop.updateList.splice(removeIndex,1);
                    Loop.updateNum--;
                }
               
            }
        }
    }
    Loop.loopIdx = 0;
    Loop.updateList = [];
    Loop.updateDir = {};
    Loop.updateNum = 0;
    badyoo.registerClass(Loop,"Loop");

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
            this.m_x = 0;
            this.m_y = 0;
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
            this.m_matrix = Pool.get(Matrix);
            this.touchEnabled = false;
            this.m_matrixChange = false;
        }

        get x()
        {
            return this.m_x;
        }
        set x(v)
        {
            if( this.m_x != v )
            {
                this.m_x = v;
                this.m_matrixChange = true;
            }
        }
        get y()
        {
            return this.m_y;
        }
        set y(v)
        {
            if( this.m_y != v )
            {
                this.m_y = v;
                this.m_matrixChange = true;
            }
        }

        get pivotX()
        {
            return this.m_pivotX;
        }
        set pivotX(v)
        {
            if( this.m_pivotX != v )
            {
                this.m_pivotX = v;
                this.m_matrixChange = true;
            }
        }
        get pivotY()
        {
            return this.m_pivotY;
        }
        set pivotY(v)
        {
            if( this.m_pivotY != v )
            {
                this.m_pivotY = v;
                this.m_matrixChange = true;
            }
        }
        get scaleX()
        {
            return this.m_scaleX;
        }
        set scaleX(v)
        {
            if( this.m_scaleX != v )
            {
                this.m_scaleX = v;
                this.m_matrixChange = true;
            }
        }
        get scaleY()
        {
            return this.m_scaleY;
        }
        set scaleY(v)
        {
            if( this.m_scaleY != v )
            {
                this.m_scaleY = v;
                this.m_matrixChange = true;
            }
        }
        set rotation(v)
        {
            if( this.m_rotation != v )
            {
                this.m_rotation = v;
                this.m_matrixChange = true;
            }
        }
        get rotation()
        {
            return this.m_rotation;
        }
        get matrix()
        {
            if( this.m_matrixChange ) this.updateMatrix();
            return this.m_matrix;
        }
        set matrix(v)
        {
            this.m_matrix = v;
        }

        pivot(x,y)
        {
            if( this.m_pivotX != x || this.m_pivotY != y  )
            {
                this.m_pivotX = x;
                this.m_pivotY = y;
                this.m_matrixChange = true;
            }
        }
        scale(x,y)
        {
            if( this.m_scaleX != x || this.m_scaleY != y  )
            {
                this.m_scaleX = x;
                this.m_scaleY = y;
                this.m_matrixChange = true;
            }
        }
        updateMatrix()
        {
            var r = this.m_rotation;
            if( r == 0 )
            {
                this.m_matrix.set(
                    this.m_scaleX, 0.0, 0.0, this.m_scaleY, 
                    this.m_x - this.m_scaleX * this.m_pivotX,this.m_y - this.m_scaleY* this.m_pivotY
                );
            }
            else
            {
                r =  r % 360;
                if( r < 0 ) r += 360;

                var cos = Maths.cos[r];
                var sin = Maths.sin[r];
                this.m_matrix.a = this.m_scaleX *  cos;
                this.m_matrix.b = this.m_scaleX *  sin;
                this.m_matrix.c = this.m_scaleY *  -sin;
                this.m_matrix.d = this.m_scaleY *  cos;
                this.m_matrix.tx = this.m_x - this.m_pivotX * this.m_matrix.a - this.m_pivotY * this.m_matrix.c;
                this.m_matrix.ty = this.m_y - this.m_pivotX * this.m_matrix.b - this.m_pivotY * this.m_matrix.d;
            }
        }
        toParentPoint(point)
        {
            var m = this.matrix;
            var x = m.a * point.x + m.c * point.y + m.tx;
            var y = m.b * point.x + m.d * point.y + m.ty;
            point.x = x;
            point.y = y;
            return point;
        }
        fromParentPoint(point)
        {
            var m = this.matrix;
            var ohter = Pool.get(Matrix);
            ohter.set(m.a,m.b,m.c,m.d,m.tx,m.ty);
            ohter.invert();
            var x = ohter.a * point.x + ohter.c * point.y + ohter.tx;
            var y = ohter.b * point.x + ohter.d * point.y + ohter.ty;
            point.x = x;
            point.y = y;
            return point;
        }
        localToGlobal(point,newPoint = false,g = null) {
            if (newPoint === true) point = Pool.get(Point).setTo(point.x,point.y);
            var p = this;
            g = g || badyoo.current.root;
            while (p) 
            {
                if (p == g)
                    break;
                point = p.toParentPoint(point);
                p = p.parent;
            }
            return point;
        }
        globalToLocal(point,newPoint = false,g = null) {
            if (newPoint === true) point = Pool.get(Point).setTo(point.x,point.y);
            var p = this;
            g = g || badyoo.current.root;
            var list = [];
            while (p) {
                if (p == g)
                    break;
                list.push(p);
                p = p.parent;
            }
            var i = list.length - 1;
            while (i >= 0) {
                p = list[i];
                point = p.fromParentPoint(point);
                i--;
            }
            return point;
        }
        hitTest(point)
        {
            if( this.width == 0 || this.height == 0 ) return false;
            if( point.x >= this.x && point.x<= this.x + this.width && point.y >= this.y && point.x<= this.y + this.height )
                return true
                
            return false;
        }
        move(x,y)
		{
			this.x = x;
			this.y = y;
        }
        updateTouchEnabled()
        {
            this.touchEnabled = this.m_onTouchMove || this.m_onTouchDown || this.m_onTouchUp || this.m_onTouchOut;
        }
        get onTouchDown()
        {
            return this.m_onTouchDown;
        }
        set onTouchDown(v)
        {
            this.m_onTouchDown = v;
            this.updateTouchEnabled();
        }
        get onTouchMove()
        {
            return this.m_onTouchMove;
        }
        set onTouchMove(v)
        {
            this.m_onTouchMove = v;
            this.updateTouchEnabled();
        }
        get onTouchUp()
        {
            return this.m_onTouchUp;
        }
        set onTouchUp(v)
        {
            this.m_onTouchUp = v;
            this.updateTouchEnabled();
        }
        get onTouchOut()
        {
            return this.m_onTouchOut;
        }
        set onTouchOut(v)
        {
            this.m_onTouchOut = v;
            this.updateTouchEnabled();
        }

        free()
        {
            if( this.parent ) this.parent.removeChild(this);
        }
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
            self.type = "image";
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

        httpRequet(data,url,handler,method = "get",responseType = "text")
        {
            var self = this;
            self.type = "httpRequet";
            self.url = url;
            self.handler = handler;
            var ajax = new XMLHttpRequest();
            ajax.open(method,url,true);
            ajax.responseType = responseType;
            ajax.setRequestHeader("Content-Type", "application/json");
            if (data == null || typeof (data) == 'string') ajax.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
            responseType = "arraybuffer";
            if( responseType !== "arraybuffer" ) responseType = "text";
            if( ajax.dataType ) ajax.dataType = responseType;
            ajax.onerror = function (e) {
                ajax.onerror = ajax.onload = ajax.onabort = null;
                self.onloaded(ajax);
            };
            ajax.onabort = function (e) {
                ajax.onerror = ajax.onload = ajax.onabort = null;
                self.onloaded(ajax);
            };
            ajax.onload = function (e) {
                ajax.onerror = ajax.onload = ajax.onabort = null;
                self.onloaded(ajax);
            };
            ajax.send(data);
        }

        onloaded(data)
        {
            if( data )
            {
                if( this.type == "image" )
                {
                    var texture = new Texture(data);
                    texture.url = this.url;
                    Loader.assets[this.url] = texture;
                }
                else
                {
                    var ajax = data;
                    var status = ajax.status !== undefined ? ajax.status : 200;
                    if (status === 200 || status === 204 || status === 0) 
                    {
                        Loader.assets[this.url] = ajax.response || ajax.responseText;
                    }
                    else {
                        console.error("[" + ajax.status + "]" + ajax.statusText + ":" + ajax.responseURL);
                    }
                    
                }

                if( this.type == "atlas" )
                {
                    this.parse(Loader.assets[this.url]);
                    return;
                }
                this.onLoadCall()
            }
            else
            {
                console.log("load error url:"+this.url);
            }
        }

        parse(str)
        {
            var data = Loader.assets[this.url] = JSON.parse(str);
            if( data.meta && data.meta.image )
            {
                Loader.load(data.meta.image,Handler.create(this,this.parseDone))
            }
        }
        parseDone(tex)
        {
            var data = Loader.assets[this.url];
            data.url = this.url;
            var arr = this.url.split(".");
            var key = arr[0];
            var spData = Sprite.AniPool[this.url] = {};
            for( var str in data.frames )
            {
                var obj = data.frames[str];
                var texture = new Texture(tex);
                var x = obj.frame.x/texture.width;
                var y = obj.frame.y/texture.height;
                var w = x + obj.frame.w/texture.width;
                var h = y + obj.frame.h/texture.height;
                if( obj.rotated)
                {
                    texture.uv[0] = w;
                    texture.uv[1] = y;
                    texture.uv[2] = w;
                    texture.uv[3] = h;
                    texture.uv[4] = x;
                    texture.uv[5] = y;
                    texture.uv[6] = x;
                    texture.uv[7] = h;
                }
                else
                {
                    texture.uv[0] = x;
                    texture.uv[1] = y;
                    texture.uv[2] = w;
                    texture.uv[3] = y;
                    texture.uv[4] = x;
                    texture.uv[5] = h;
                    texture.uv[6] = w;
                    texture.uv[7] = h;
                }
                texture.url = key+"/"+str;
                var frameName = str.slice(0,str.length -4);
                var frames = spData[frameName] || ( spData[frameName] = [] );
                frames.push(texture.url);
                texture.width = obj.sourceSize.w;
                texture.height = obj.sourceSize.h;
                Texture.atlas[texture.url] = texture;
            }
            this.onLoadCall();
        }
        onLoadCall()
        {
            if( this.handler.length != null )
            {
                var len = this.handler.length;
                for( var i = 0;i<len;i++ )
                {
                    this.handler[i].run(Loader.assets[this.url]);
                }
                this.handler.length = 0;
            }
            else
            {
                this.handler.run(Loader.assets[this.url]);
            }
            this.handler = null;
            this.url = "";
            this.type = "";
            Pool.set(Loader,this);
            delete Loader.pool[this.url];
        }

        static load(url,handler,type)
        {
           if( Texture.atlas[url] )
           {
               handler.run(Texture.atlas[url]);
               return;
           }
           if( Loader.assets[url] )
           {
               handler.run(Loader.assets[url]);
               return;
           }
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
                if(url.lastIndexOf(".json") > -1)
                {
                    loader.httpRequet(null,url,handler);
                }
                else
                {
                    loader.load(url,handler);
                }

                if( type != null ) loader.type = type;
               
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
            this.uv = 
            [
                0,0,
                1,0,
                0,1,
                1,1
            ]
            if( data instanceof Texture == false ) this.tex = badyoo.current.uploadTexture(data);
            else this.tex = data.tex;
        }
    }
    Texture.atlas = {};
    badyoo.registerClass(Texture,"Texture");

    class Layer extends GameObject
    {
        constructor()
        {
            super();
            this.displayList = [];
            this.displayNum = 0;
            this.touchEnabled = true;
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
            this.loaded = false;
        }
        set skin(v)
        {
            this.loaded = false;
            this.m_skin = v;
            Loader.load(this.m_skin,Handler.create(this,this.skinLoaded))
        }

        get skin()
        {
            return this.m_skin;
        }

        skinLoaded(v)
        {
            if( v.url == this.m_skin ) this.texture = v, this.loaded = true;
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

    class Sprite extends Image
    {
        constructor()
        {
            super();
            this.fps = 30;
            this.currentFrame = 0;
            this.totalframes = 0;
            this.currentAnimation = "";
            this.loop = true;
            this.m_frames = null;
            this.m_stop = false;
            Sprite.pool.push(this);
        }

        set fps(v)
        {
            this.m_fps = v;
            this.interval = 1000/v;
        }

        get fps()
        {
            return this.m_fps;
        }

        set skin(v)
        {
            this.m_skin = v;
            this.loaded = false;
            Loader.load(this.m_skin,Handler.create(this,this.skinLoaded),"atlas")
        }

        get skin()
        {
            return this.m_skin;
        }
        skinLoaded(v)
        {
            if( v.url == this.m_skin )
            {
                this.loaded = true;
                if( this.currentAnimation != "" )
                {
                    this.playAni(this.currentAnimation);
                }
            }
        }
        playAni(animation)
        {
            this.currentAnimation = animation;
            this.totalframes = this.currentFrame = 0;
            
            if( this.loaded )
            {
                this.m_frames = Sprite.AniPool[this.m_skin][this.currentAnimation];
                if( this.m_frames )
                {
                    this.totalframes = this.m_frames.length;
                    if( this.m_stop ) this.gotoAndStop(1);
                    else this.gotoAndPlay(1);
                    
                }
            }
        }
        play()
        {
            this.m_stop = false; 
            this.lastTime = Date.now();
        }
        stop()
        {
            this.m_stop = true;
            this.lastTime = 0;
        }
        gotoAndStop(frame)
        {
            if( frame > 0 ) 
            {
                if( frame > this.totalframes ) 
                {
                    if( this.loop ) frame = frame % this.totalframes;
                    else frame = this.totalframes; 
                }
                this.currentFrame = frame;
                this.stop();
                this.texture = Texture.atlas[this.m_frames[this.currentFrame-1]];
            }
        }
        gotoAndPlay(frame)
        {
            if( frame > 0 ) 
            {
                if( frame > this.totalframes ) 
                {
                    if( this.loop ) frame = frame % this.totalframes;
                    else frame = this.totalframes; 
                }
                this.currentFrame = frame;
                this.play();
                this.texture = Texture.atlas[this.m_frames[this.currentFrame-1]];
            }
        }

        free()
        {
            Sprite.pool.splice(Sprite.pool.indexOf(this),1);
            super.free();
        }
    }
    Sprite.AniPool = {};
    Sprite.pool = [];
    badyoo.registerClass(Sprite,"Sprite");
    class SpriteFont extends GameObject
    {
        constructor()
        {
            super();
            this.m_text = "";
            this.m_spacing = 0;
            this.m_lineHeight = 0;
            this.m_spaceWidth = 0;
            this.m_skin = "";
        }

        get skin()
        {
            return this.m_skin;
        }
        set skin(v)
        {
            this.m_skin = v;
            Loader.load(this.m_skin,Handler.create(this,this.skinLoaded))
        }
        skinLoaded(v)
        {
            if( v.url == this.m_skin )
            {
                this.texture = v;
            }
        }

        get text()
        {
            return this.m_text;
        }
        set text(v)
        {
            this.m_text = v;
        }
        get spacing()
        {
            return this.m_spacing;
        }
        set spacing(v)
        {
            this.m_spacing = v;
        }
        get lineHeight()
        {
            return this.m_lineHeight;
        }
        set lineHeight(v)
        {
            this.m_lineHeight = v;
        }
        get spaceWidth()
        {
            return this.m_spaceWidth;
        }
        set spaceWidth(v)
        {
            this.m_spaceWidth = v;
        }
    }
    badyoo.registerClass(SpriteFont,"SpriteFont");
    class SoundMgr
    {
        static playSound(url,num)
        {
            SoundMgr.soundPool[url] = new Audio(url).play();
        }
        static stopSound(url)
        {

        }
        static playMusic(url,num = -1)
        {
            var audio = new Audio(url);
            audio.loop = num == -1;
            audio.play();
            SoundMgr.musicPool[url] = audio;
        }
        static stopMusic(url)
        {

        }
    }
    SoundMgr.soundPool = {};
    SoundMgr.musicPool = {};
    badyoo.registerClass(SoundMgr,"SoundMgr");
    
    badyoo.current = new badyoo["BYGL"]();
    badyoo["power"] = function(w,h,ac = true,c = null,r = null)
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
