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
          className={className}
          style={{
            ...style,
            margin: 0,
            padding: "12px",
            borderRadius: "6px",
            fontSize: "13px",
            lineHeight: "1.5",
            overflow: "auto",
          }}
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
