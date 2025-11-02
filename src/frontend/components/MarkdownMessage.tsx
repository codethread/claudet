import Markdown from 'markdown-to-jsx';
import { cn } from '@/lib/utils';

interface MarkdownMessageProps {
	content: string;
	className?: string;
}

export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
	return (
		<Markdown
			className={cn('text-sm markdown-content', className)}
			options={{
				overrides: {
					// Links open in new tab
					a: {
						component: ({ children, ...props }) => (
							<a
								{...props}
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary hover:underline"
							>
								{children}
							</a>
						),
					},
					// Code blocks with background
					code: {
						component: ({ children, className, ...props }) => {
							const isInline = !className;
							return (
								<code
									{...props}
									className={cn(
										isInline
											? 'bg-muted px-1.5 py-0.5 rounded text-xs font-mono'
											: 'block bg-muted p-3 rounded-lg my-2 text-xs font-mono overflow-x-auto',
										className,
									)}
								>
									{children}
								</code>
							);
						},
					},
					// Pre blocks (wraps code blocks)
					pre: {
						component: ({ children }) => <div className="my-2">{children}</div>,
					},
					// Headers with appropriate sizing
					h1: {
						component: ({ children }) => (
							<h1 className="text-2xl font-bold mt-4 mb-2">{children}</h1>
						),
					},
					h2: {
						component: ({ children }) => (
							<h2 className="text-xl font-bold mt-3 mb-2">{children}</h2>
						),
					},
					h3: {
						component: ({ children }) => (
							<h3 className="text-lg font-semibold mt-3 mb-1">{children}</h3>
						),
					},
					h4: {
						component: ({ children }) => (
							<h4 className="text-base font-semibold mt-2 mb-1">{children}</h4>
						),
					},
					h5: {
						component: ({ children }) => (
							<h5 className="text-sm font-semibold mt-2 mb-1">{children}</h5>
						),
					},
					h6: {
						component: ({ children }) => (
							<h6 className="text-xs font-semibold mt-2 mb-1">{children}</h6>
						),
					},
					// Blockquotes with left border
					blockquote: {
						component: ({ children }) => (
							<blockquote className="border-l-4 border-primary/30 pl-4 py-2 my-2 italic text-muted-foreground">
								{children}
							</blockquote>
						),
					},
					// Lists with proper spacing
					ul: {
						component: ({ children }) => (
							<ul className="list-disc list-inside my-2 space-y-1">{children}</ul>
						),
					},
					ol: {
						component: ({ children }) => (
							<ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>
						),
					},
					// Paragraphs with spacing
					p: {
						component: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
					},
				},
			}}
		>
			{content}
		</Markdown>
	);
}
