import { useEffect, useRef, useState } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { yaml } from '@codemirror/lang-yaml';
import { json } from '@codemirror/lang-json';
import { linter, Diagnostic, lintGutter } from '@codemirror/lint';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { AlertTriangle } from 'lucide-react';
import { StreamLanguage } from '@codemirror/language';

// Custom highlight style with vibrant colors
const mineserverHighlight = HighlightStyle.define([
    { tag: tags.keyword, color: '#ff79c6', fontWeight: 'bold' },
    { tag: tags.string, color: '#50fa7b' },
    { tag: tags.number, color: '#bd93f9' },
    { tag: tags.bool, color: '#ff79c6' },
    { tag: tags.propertyName, color: '#8be9fd', fontWeight: 'bold' },
    { tag: tags.comment, color: '#6272a4', fontStyle: 'italic' },
    { tag: tags.operator, color: '#ff79c6' },
    { tag: tags.punctuation, color: '#f8f8f2' },
    { tag: tags.atom, color: '#bd93f9' },
    { tag: tags.meta, color: '#ffb86c' },
    { tag: tags.name, color: '#f1fa8c' },
    { tag: tags.labelName, color: '#8be9fd' },
    { tag: tags.definition(tags.variableName), color: '#50fa7b' },
]);

// Dark theme for Mineserver (Dracula-inspired)
const mineserverTheme = EditorView.theme({
    "&": {
        backgroundColor: "#0d1117",
        color: "#f8f8f2",
        height: "100%",
        fontSize: "13px",
    },
    ".cm-content": {
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
        caretColor: "#ff79c6",
        padding: "8px 0",
    },
    ".cm-cursor": {
        borderLeftColor: "#ff79c6",
        borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, ::selection": {
        backgroundColor: "#44475a",
    },
    ".cm-selectionBackground": {
        backgroundColor: "#44475a",
    },
    ".cm-gutters": {
        backgroundColor: "#161b22",
        color: "#6272a4",
        border: "none",
        borderRight: "1px solid #21262d",
    },
    ".cm-activeLineGutter": {
        backgroundColor: "#282a36",
        color: "#f8f8f2",
    },
    ".cm-activeLine": {
        backgroundColor: "#282a3680",
    },
    ".cm-line": {
        padding: "0 8px",
    },
    ".cm-lintRange-error": {
        backgroundImage: "none",
        borderBottom: "2px wavy #ff5555",
    },
    ".cm-lintRange-warning": {
        backgroundImage: "none",
        borderBottom: "2px wavy #ffb86c",
    },
    ".cm-diagnostic": {
        backgroundColor: "#282a36",
        border: "1px solid #44475a",
        borderRadius: "6px",
        padding: "6px 10px",
    },
    ".cm-diagnostic-error": {
        borderLeftColor: "#ff5555",
        borderLeftWidth: "3px",
    },
    ".cm-diagnostic-warning": {
        borderLeftColor: "#ffb86c",
        borderLeftWidth: "3px",
    },
    ".cm-scroller": {
        overflow: "auto",
        scrollbarWidth: "thin",
        scrollbarColor: "#6272a4 #0d1117",
    },
    ".cm-matchingBracket": {
        backgroundColor: "#44475a",
        outline: "1px solid #50fa7b",
    },
}, { dark: true });

// Simple properties file language definition
const propertiesLanguage = StreamLanguage.define({
    token(stream) {
        // Comments
        if (stream.match(/^#.*/)) {
            return 'comment';
        }
        // Key (before =)
        if (stream.sol() && stream.match(/^[a-zA-Z0-9._-]+(?==)/)) {
            return 'propertyName';
        }
        // Operator (=)
        if (stream.match(/^=/)) {
            return 'operator';
        }
        // Boolean values
        if (stream.match(/^(true|false)\b/i)) {
            return 'bool';
        }
        // Numbers
        if (stream.match(/^-?\d+(\.\d+)?/)) {
            return 'number';
        }
        // Consume rest of line as string/value
        stream.next();
        return 'string';
    },
});

// YAML linter
function yamlLinter(view: EditorView): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = view.state.doc.toString();
    const lines = text.split('\n');

    lines.forEach((line, i) => {
        const lineStart = view.state.doc.line(i + 1).from;

        // Check for tabs
        if (line.includes('\t')) {
            const tabIndex = line.indexOf('\t');
            diagnostics.push({
                from: lineStart + tabIndex,
                to: lineStart + tabIndex + 1,
                severity: 'error',
                message: 'YAML: Use spaces instead of tabs',
            });
        }
    });

    return diagnostics;
}

// JSON linter
function jsonLinter(view: EditorView): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = view.state.doc.toString();

    try {
        JSON.parse(text);
    } catch (e: any) {
        const match = e.message.match(/at position (\d+)/);
        const pos = match ? parseInt(match[1]) : 0;
        diagnostics.push({
            from: pos,
            to: Math.min(pos + 10, text.length),
            severity: 'error',
            message: e.message,
        });
    }

    return diagnostics;
}

// Properties linter
function propertiesLinter(view: EditorView): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = view.state.doc.toString();
    const lines = text.split('\n');

    lines.forEach((line, i) => {
        const lineStart = view.state.doc.line(i + 1).from;
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) return;

        // Check for missing '='
        if (!line.includes('=')) {
            diagnostics.push({
                from: lineStart,
                to: lineStart + line.length,
                severity: 'error',
                message: 'Missing "=" separator',
            });
        }
    });

    return diagnostics;
}

interface CodeEditorProps {
    value: string;
    onChange: (value: string) => void;
    language?: 'yaml' | 'json' | 'properties' | 'text';
    readOnly?: boolean;
}

export function CodeEditor({ value, onChange, language = 'text', readOnly = false }: CodeEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const [errors] = useState<Diagnostic[]>([]);

    useEffect(() => {
        if (!editorRef.current) return;

        // Build extensions
        const extensions = [
            basicSetup,
            mineserverTheme,
            syntaxHighlighting(mineserverHighlight),
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    onChange(update.state.doc.toString());
                }
            }),
            EditorView.lineWrapping,
            lintGutter(),
        ];

        // Add language support
        if (language === 'yaml') {
            extensions.push(yaml());
            extensions.push(linter(yamlLinter, { delay: 500 }));
        } else if (language === 'json') {
            extensions.push(json());
            extensions.push(linter(jsonLinter, { delay: 500 }));
        } else if (language === 'properties') {
            extensions.push(propertiesLanguage);
            extensions.push(linter(propertiesLinter, { delay: 500 }));
        }

        if (readOnly) {
            extensions.push(EditorState.readOnly.of(true));
        }

        const state = EditorState.create({
            doc: value,
            extensions,
        });

        const view = new EditorView({
            state,
            parent: editorRef.current,
        });

        viewRef.current = view;

        return () => {
            view.destroy();
        };
    }, [language, readOnly]);

    // Update content from outside
    useEffect(() => {
        if (viewRef.current) {
            const currentValue = viewRef.current.state.doc.toString();
            if (currentValue !== value) {
                viewRef.current.dispatch({
                    changes: {
                        from: 0,
                        to: currentValue.length,
                        insert: value,
                    },
                });
            }
        }
    }, [value]);

    return (
        <div className="flex flex-col h-full">
            <div ref={editorRef} className="flex-1 overflow-hidden" />
            {errors.length > 0 && (
                <div className="p-2 bg-red-500/10 border-t border-red-500/20 flex items-center gap-2 text-xs text-red-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {errors.length} error(s) found
                </div>
            )}
        </div>
    );
}
