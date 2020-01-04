declare module badyoo 
{
    function Instantiate(o:GameObject):GameObject
    function power(width:number = 0,height:number = 0,alignC:boolean = true,canvas:HTMLCanvasElement = null,root = null):void
    function bgColor(color:number);
    class GameObject
    {
        x:number;
        y:number;
        pivotX:number;
        pivotY:number;
        scaleX:number;
        scaleY:number;
        rotation:number;
        matrix:any
        pivot(x:number,y:number):void;
        scale(x:number,y:number):void;
        toParentPoint(point:Point):Point;
        fromParentPoint(point:Point):Point;
        localToGlobal(point:Point,newPoint:boolean = false,g:GameObject = null):Point;
        globalToLocal(point:Point,newPoint:boolean = false,g:GameObject = null):Point;
        hitTest(point:Point):boolean;
        move(x:number,y:number):void;
        free():void;
    }
}
