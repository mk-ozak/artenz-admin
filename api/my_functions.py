from reportlab.pdfbase.pdfmetrics import stringWidth


def y(c):
    return 842 - c


def wrap_lines(text, font, size, max_width, max_lines=2):
    words, lines, cur = text.split(), [], ""
    for i, w in enumerate(words):
        test = (cur + " " + w).strip()
        if cur and stringWidth(test, font, size) > max_width:
            lines.append(cur)
            cur = w
            if len(lines) == max_lines - 1:               # posledný riadok = zvyšok slov
                cur = " ".join([cur] + words[i + 1:]); break
        else:
            cur = test
    lines.append(cur)
    return lines


def pol(sentence, cast, font="MyriadSB", size=20, max_width=380):
    """Drop-in náhrada pôvodného pol() – delí podľa skutočnej šírky textu, nie počtu znakov."""
    lines = wrap_lines(sentence or "", font, size, max_width, 2)
    return (lines[0] if lines else "") if cast == 1 else (lines[1] if len(lines) > 1 else "")
