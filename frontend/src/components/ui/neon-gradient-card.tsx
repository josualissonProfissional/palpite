"use client"

import {
  CSSProperties,
  ReactElement,
  ReactNode,
} from "react"

import { cn } from "@/lib/utils"

interface NeonColorsProps {
  firstColor: string
  secondColor: string
}

interface NeonGradientCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * @default <div />
   * @type ReactElement
   * @description
   * The component to be rendered as the card
   * */
  as?: ReactElement
  /**
   * @default ""
   * @type string
   * @description
   * The className of the card
   */
  className?: string
  /**
   * @default ""
   * @type string
   * @description
   * The className of the card content
   */
  contentClassName?: string
  /**
   * @default false
   * @type boolean
   * @description
   * Let the card size itself by content instead of filling the parent.
   */
  autoSize?: boolean

  /**
   * @default ""
   * @type ReactNode
   * @description
   * The children of the card
   * */
  children?: ReactNode

  /**
   * @default 5
   * @type number
   * @description
   * The size of the border in pixels
   * */
  borderSize?: number

  /**
   * @default 20
   * @type number
   * @description
   * The size of the radius in pixels
   * */
  borderRadius?: number

  /**
   * @default "{ firstColor: '#ff00aa', secondColor: '#00FFF1' }"
   * @type string
   * @description
   * The colors of the neon gradient
   * */
  neonColors?: NeonColorsProps
}

export const NeonGradientCard: React.FC<NeonGradientCardProps> = ({
  className,
  contentClassName,
  autoSize = false,
  children,
  borderSize = 2,
  borderRadius = 20,
  neonColors = {
    firstColor: "#ff00aa",
    secondColor: "#00FFF1",
  },
  ...props
}) => {
  return (
    <div
      style={
        {
          "--border-size": `${borderSize}px`,
          "--border-radius": `${borderRadius}px`,
          "--neon-first-color": neonColors.firstColor,
          "--neon-second-color": neonColors.secondColor,
          "--card-content-radius": `${borderRadius - borderSize}px`,
          "--pseudo-element-background-image": `linear-gradient(0deg, ${neonColors.firstColor}, ${neonColors.secondColor})`,
        } as CSSProperties
      }
      className={cn(
        "relative z-10 rounded-(--border-radius)",
        autoSize ? "h-auto w-full" : "size-full",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "relative size-full min-h-[inherit] rounded-(--card-content-radius) bg-white p-6 shadow-sm",
          autoSize && "h-auto",
          "before:absolute before:inset-[calc(var(--border-size)*-1)] before:-z-10 before:block",
          "before:rounded-(--border-radius) before:content-['']",
          "before:bg-[linear-gradient(0deg,var(--neon-first-color),var(--neon-second-color))] before:bg-size-[100%_200%]",
          "before:animate-background-position-spin",
          "after:absolute after:inset-[calc(var(--border-size)*-1)] after:-z-10 after:block",
          "after:rounded-(--border-radius) after:blur-2xl after:content-['']",
          "after:bg-[linear-gradient(0deg,var(--neon-first-color),var(--neon-second-color))] after:bg-size-[100%_200%] after:opacity-80",
          "after:animate-background-position-spin",
          "dark:bg-black dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
          "wrap-break-word",
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  )
}
