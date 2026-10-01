type CoverTone = "iris" | "mint" | "peach";
export function TypographyCover({ title, caption, tone = "iris" }: {
  title: string; caption?: string; tone?: CoverTone;
}) {
  return <div className={`typography-cover cover-${tone}`} role="img" aria-label={`${title} 텍스트 표지`}>
    <span className="cover-symbol" aria-hidden="true">✳</span>
    <span className="cover-title">{title}</span>
    {caption ? <span className="cover-caption">{caption}</span> : null}
    <span className="cover-line" aria-hidden="true" />
  </div>;
}
