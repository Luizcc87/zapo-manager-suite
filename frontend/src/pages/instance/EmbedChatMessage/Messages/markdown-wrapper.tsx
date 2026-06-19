/* eslint-disable @typescript-eslint/no-explicit-any */

const MarkdownWrapper = ({ children }: any) => {
  if (!children) return null;

  let processedChildren = children
    .replace(/\*(.*?)\*/g, "<strong>$1</strong>")
    .replace(/_(.*?)_/g, "<em>$1</em>")
    .replace(/~(.*?)~/g, "<del>$1</del>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br/>");

  const linkRegex = /(https?:\/\/[^\s<]+)/g;

  processedChildren = processedChildren.replace(linkRegex, `<a className="link-chat" href="$1" target="_blank">$1</a>`);

  processedChildren = `<p>${processedChildren}</p>`;

  return <div dangerouslySetInnerHTML={{ __html: processedChildren }} className="formatted-message" />;
};

export { MarkdownWrapper };
