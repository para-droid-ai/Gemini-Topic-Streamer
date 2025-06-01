
// utils/textUtils.ts
export const stripMarkdown = (markdown: string): string => {
  let output = markdown;

  // Remove HTML tags first to avoid conflicts with markdown processing
  output = output.replace(/<[^>]*>/g, '');

  // Remove code blocks (```...``` and ~~~...~~~)
  output = output.replace(/```([\s\S]*?)```/g, '');
  output = output.replace(/~~~([\s\S]*?)~~~/g, '');

  // Remove inline code (`...`)
  output = output.replace(/`([^`]+)`/g, '$1');
  
  // Remove images, keeping alt text: ![alt text](image url)
  output = output.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1');
  
  // Remove links, keeping link text: [link text](url)
  output = output.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

  // Remove headers (e.g., # Header, ## Header)
  output = output.replace(/^#{1,6}\s+(.*)/gm, '$1');

  // Remove bold and italic (**text** or __text__, *text* or _text_)
  output = output.replace(/(\*\*|__)(.*?)\1/g, '$2');
  output = output.replace(/(\*|_)(.*?)\1/g, '$2');

  // Remove strikethrough (~~text~~)
  output = output.replace(/~~(.*?)~~/g, '$1');

  // Remove blockquotes (> text)
  output = output.replace(/^>\s?(.*)/gm, '$1');

  // Remove horizontal rules (---, ***, ___)
  output = output.replace(/^(---|___|\*\*\*)\s*$/gm, '');

  // Remove list item markers (unordered: *, -, +; ordered: 1., 2.)
  output = output.replace(/^\s*([-*+])\s+/gm, ''); // Unordered lists
  output = output.replace(/^\s*\d+\.\s+/gm, '');   // Ordered lists
  
  // Replace multiple newlines with a single space for better sentence flow in TTS
  output = output.replace(/\n+/g, ' ');

  // Trim leading/trailing whitespace
  output = output.trim();

  return output;
};
