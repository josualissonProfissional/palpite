"use client";

import {
  createElement,
  type ElementType,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { gsap } from "gsap";

type VariableSpeed = {
  min: number;
  max: number;
};

type TextTypeProps = {
  text: string | string[];
  as?: ElementType;
  typingSpeed?: number;
  initialDelay?: number;
  pauseDuration?: number;
  deletingSpeed?: number;
  loop?: boolean;
  className?: string;
  showCursor?: boolean;
  hideCursorWhileTyping?: boolean;
  cursorCharacter?: ReactNode;
  cursorClassName?: string;
  cursorBlinkDuration?: number;
  textColors?: string[];
  variableSpeed?: VariableSpeed;
  onSentenceComplete?: (sentence: string, index: number) => void;
  startOnVisible?: boolean;
  reverseMode?: boolean;
};

export function TextType({
  text,
  as: Component = "div",
  typingSpeed = 50,
  initialDelay = 0,
  pauseDuration = 2000,
  deletingSpeed = 30,
  loop = true,
  className = "",
  showCursor = true,
  hideCursorWhileTyping = false,
  cursorCharacter = "|",
  cursorClassName = "",
  cursorBlinkDuration = 0.5,
  textColors = [],
  variableSpeed,
  onSentenceComplete,
  startOnVisible = false,
  reverseMode = false,
}: TextTypeProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(!startOnVisible);
  const cursorRef = useRef<HTMLSpanElement | null>(null);
  const containerRef = useRef<HTMLSpanElement | null>(null);

  const textArray = useMemo(() => (Array.isArray(text) ? text : [text]), [text]);
  const currentText = textArray[currentTextIndex] ?? "";

  const getRandomSpeed = useCallback(() => {
    if (!variableSpeed) return typingSpeed;
    const { min, max } = variableSpeed;
    return Math.random() * (max - min) + min;
  }, [variableSpeed, typingSpeed]);

  const getCurrentTextColor = () => {
    if (textColors.length === 0) return "inherit";
    return textColors[currentTextIndex % textColors.length];
  };

  useEffect(() => {
    if (!startOnVisible || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 },
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [startOnVisible]);

  useEffect(() => {
    if (!showCursor || !cursorRef.current) return;

    gsap.set(cursorRef.current, { opacity: 1 });
    const tween = gsap.to(cursorRef.current, {
      opacity: 0,
      duration: cursorBlinkDuration,
      repeat: -1,
      yoyo: true,
      ease: "power2.inOut",
    });

    return () => {
      tween.kill();
    };
  }, [showCursor, cursorBlinkDuration]);

  useEffect(() => {
    if (!isVisible) return;

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const processedText = reverseMode ? currentText.split("").reverse().join("") : currentText;

    if (isDeleting) {
      if (displayedText === "") {
        timeout = setTimeout(() => {
          setIsDeleting(false);

          if (currentTextIndex === textArray.length - 1 && !loop) {
            return;
          }

          onSentenceComplete?.(textArray[currentTextIndex] ?? "", currentTextIndex);
          setCurrentTextIndex((prev) => (prev + 1) % textArray.length);
          setCurrentCharIndex(0);
        }, 0);
      } else {
        timeout = setTimeout(() => {
          setDisplayedText((prev) => prev.slice(0, -1));
        }, deletingSpeed);
      }
    } else if (currentCharIndex < processedText.length) {
      const delay = currentCharIndex === 0 && displayedText === "" ? initialDelay : 0;
      timeout = setTimeout(
        () => {
          setDisplayedText((prev) => prev + processedText[currentCharIndex]);
          setCurrentCharIndex((prev) => prev + 1);
        },
        delay + (variableSpeed ? getRandomSpeed() : typingSpeed),
      );
    } else if (textArray.length >= 1) {
      if (!loop && currentTextIndex === textArray.length - 1) {
        return undefined;
      }
      timeout = setTimeout(() => {
        setIsDeleting(true);
      }, pauseDuration);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [
    currentCharIndex,
    currentText,
    currentTextIndex,
    deletingSpeed,
    displayedText,
    getRandomSpeed,
    initialDelay,
    isDeleting,
    isVisible,
    loop,
    onSentenceComplete,
    pauseDuration,
    reverseMode,
    textArray,
    typingSpeed,
    variableSpeed,
  ]);

  const shouldHideCursor =
    hideCursorWhileTyping && (currentCharIndex < currentText.length || isDeleting);

  const typedContent = createElement(
    Component,
    { className: `text-type ${className}` },
    <>
      <span className="text-type__content" style={{ color: getCurrentTextColor() || "inherit" }}>
        {displayedText}
      </span>
      {showCursor ? (
        <span
          ref={cursorRef}
          className={`text-type__cursor ${cursorClassName} ${shouldHideCursor ? "text-type__cursor--hidden" : ""}`}
        >
          {cursorCharacter}
        </span>
      ) : null}
    </>,
  );

  return (
    <span ref={containerRef} className="contents">
      {typedContent}
    </span>
  );
}
