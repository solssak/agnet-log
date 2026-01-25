import { Highlight, themes } from "prism-react-renderer";

type Props = {
  code: string;
  language: string;
};

export function CodeBlock({ code, language }: Props) {
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  return (
    <Highlight
      theme={isDark ? themes.vsDark : themes.vsLight}
      code={code.trim()}
      language={language}
    >
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={`${className} m-0 p-3 text-[13px] leading-relaxed overflow-auto`}
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
