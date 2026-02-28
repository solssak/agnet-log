import { Highlight, themes } from "prism-react-renderer";
import { useDarkMode } from "../hooks/useDarkMode";
import { cn } from "../utils/cn";

type Props = {
  code: string;
  language: string;
};

export function CodeBlock({ code, language }: Props) {
  const isDark = useDarkMode();

  return (
    <Highlight
      theme={isDark ? themes.vsDark : themes.vsLight}
      code={code.trim()}
      language={language}
    >
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={cn(className, "m-0 p-3 text-[13px] leading-relaxed overflow-x-auto max-w-full")}
          style={style}
        >
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}
