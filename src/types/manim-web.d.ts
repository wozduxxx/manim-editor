// // src/types/manim-web.d.ts
// // Type declarations for manim-web library
//
// declare module 'manim-web' {
//     // ─── Basic Types ───────────────────────────────────────────────────────────
//     export type Color = string;
//     export type Point3D = [number, number, number];
//
//     // ─── Mobject Base Class ────────────────────────────────────────────────────
//     export class Mobject {
//         // Appearance
//         setColor(color: Color): this;
//         setFillOpacity(opacity: number): this;
//         setStrokeWidth(width: number): this;
//         setStrokeOpacity(opacity: number): this;
//         setStrokeColor(color: Color): this;
//
//         // Position
//         moveTo(point: Point3D): this;
//         shift(delta: Point3D): this;
//         scale(factor: number): this;
//         rotate(angle: number): this;
//
//         // Animation helper
//         animate: {
//             moveTo(point: Point3D, config?: AnimationConfig): Mobject;
//             shift(delta: Point3D, config?: AnimationConfig): Mobject;
//             scale(factor: number, config?: AnimationConfig): Mobject;
//             rotate(angle: number, config?: AnimationConfig): Mobject;
//         };
//
//         // Utilities
//         getCenter(): Point3D;
//         getStart(): Point3D;
//         getEnd(): Point3D;
//     }
//
//     // ─── Shape Mobjects ────────────────────────────────────────────────────────
//     export interface CircleOptions {
//         radius?: number;
//         color?: Color;
//         fillOpacity?: number;
//         strokeWidth?: number;
//         strokeColor?: Color;
//     }
//
//     export class Circle extends Mobject {
//         constructor(options?: CircleOptions);
//         radius: number;
//     }
//
//     export interface SquareOptions {
//         sideLength?: number;
//         color?: Color;
//         fillOpacity?: number;
//         strokeWidth?: number;
//         strokeColor?: Color;
//     }
//
//     export class Square extends Mobject {
//         constructor(options?: SquareOptions);
//         sideLength: number;
//     }
//
//     export interface TriangleOptions {
//         sideLength?: number;
//         color?: Color;
//         fillOpacity?: number;
//         strokeWidth?: number;
//         strokeColor?: Color;
//     }
//
//     export class Triangle extends Mobject {
//         constructor(options?: TriangleOptions);
//         sideLength: number;
//     }
//
//     // ─── Scene ─────────────────────────────────────────────────────────────────
//     export interface SceneOptions {
//         width?: number;
//         height?: number;
//         backgroundColor?: Color;
//         antialias?: boolean;
//         alpha?: boolean;
//     }
//
//     export class Scene {
//         constructor(container: HTMLElement, options?: SceneOptions);
//
//         add(mobject: Mobject): void;
//         remove(mobject: Mobject): void;
//         clear(): void;
//
//         play(animation: Animation, config?: AnimationConfig): Promise<void>;
//         wait(duration: number): Promise<void>;
//
//         start(): void;
//         stop(): void;
//         dispose(): void;
//     }
//
//     // ─── Animations ────────────────────────────────────────────────────────────
//     export interface AnimationConfig {
//         runTime?: number;
//         duration?: number;
//         rateFunc?: (t: number) => number;
//         lagRatio?: number;
//     }
//
//     export class Animation {
//         constructor(mobject: Mobject, config?: AnimationConfig);
//         mobject: Mobject;
//         runTime: number;
//     }
//
//     export class Create extends Animation {
//         constructor(mobject: Mobject, config?: AnimationConfig);
//     }
//
//     export class FadeIn extends Animation {
//         constructor(mobject: Mobject, config?: AnimationConfig);
//     }
//
//     export class FadeOut extends Animation {
//         constructor(mobject: Mobject, config?: AnimationConfig);
//     }
//
//     export class Write extends Animation {
//         constructor(mobject: Mobject, config?: AnimationConfig);
//     }
//
//     export class GrowFromCenter extends Animation {
//         constructor(mobject: Mobject, config?: AnimationConfig);
//     }
//
//     export class Transform extends Animation {
//         constructor(source: Mobject, target: Mobject, config?: AnimationConfig);
//         source: Mobject;
//         target: Mobject;
//     }
//
//     export class Indicate extends Animation {
//         constructor(mobject: Mobject, config?: AnimationConfig);
//     }
//
//     // ─── Constants ─────────────────────────────────────────────────────────────
//     export const BLACK: Color;
//     export const WHITE: Color;
//     export const RED: Color;
//     export const GREEN: Color;
//     export const BLUE: Color;
//     export const YELLOW: Color;
//
//     // ─── Vectors ───────────────────────────────────────────────────────────────
//     export const ORIGIN: Point3D;
//     export const UP: Point3D;
//     export const DOWN: Point3D;
//     export const LEFT: Point3D;
//     export const RIGHT: Point3D;
// }