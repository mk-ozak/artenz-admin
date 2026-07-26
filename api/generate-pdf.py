# api/generate-pdf.py – Vercel Python serverless funkcia (sebestačná).
# Zámerne BEZ susedných modulov (data.py/my_functions.py) – Vercel by ich
# musel zabaliť do funkcie, čo pri lazy importoch zlyháva ("No module named …").
# Externé závislosti: reportlab + requests (requirements.txt), assets/ (vercel.json includeFiles).
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from os.path import dirname, abspath, join
from datetime import date, timedelta
import io
import os

DIR = dirname(abspath(__file__))
ASSETS = join(DIR, "assets")        # fonty + logo (pribalené cez vercel.json includeFiles)

DNI_SK = ["pondelok", "utorok", "streda", "štvrtok", "piatok", "sobota", "nedeľa"]

# globály naplní _setup() (lazy reportlab + fonty), aby sa chyba vrátila
# cez handler ako čitateľná 500-ka, nie ako FUNCTION_INVOCATION_FAILED.
c = None
canvas = None
stringWidth = None
my_black = my_dblue = my_white = None
_ready = False


def _setup():
    global canvas, stringWidth, my_black, my_dblue, my_white, _ready
    if _ready:
        return
    from reportlab.pdfgen import canvas as _canvas
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfbase.pdfmetrics import stringWidth as _stringWidth
    from reportlab.lib.colors import CMYKColor

    canvas = _canvas
    stringWidth = _stringWidth
    pdfmetrics.registerFont(TTFont("MyriadSB",     join(ASSETS, "MyriadPro-Semibold.ttf")))
    pdfmetrics.registerFont(TTFont("MyriadB",      join(ASSETS, "MyriadPro-Bold.ttf")))
    pdfmetrics.registerFont(TTFont("MyriadBlck",   join(ASSETS, "MyriadPro-Black.ttf")))
    pdfmetrics.registerFont(TTFont("MyriadBolCon", join(ASSETS, "MyriadPro-BoldCond.ttf")))
    pdfmetrics.registerFont(TTFont("MyriadCond",   join(ASSETS, "MyriadPro-Cond.ttf")))
    my_black = CMYKColor(0, 0, 0, 1)
    my_dblue = CMYKColor(0.40, 0.19, 0, 0.64)
    my_white = CMYKColor(0, 0, 0, 0)
    _ready = True


# ============================================================
# Text helpers (pôvodné my_functions.py)
# ============================================================
def y(coord):
    return 842 - coord


def wrap_lines(text, font, size, max_width, max_lines=2):
    text = text or ""
    if "\n" in text:                                  # tvrdé zalomenie (napr. zlúčený rezeň)
        lines = [p.strip() for p in text.split("\n")][:max_lines]
        while len(lines) < max_lines:
            lines.append("")
        return lines
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
    """Delí podľa skutočnej šírky textu, nie počtu znakov."""
    lines = wrap_lines(sentence or "", font, size, max_width, 2)
    return (lines[0] if lines else "") if cast == 1 else (lines[1] if len(lines) > 1 else "")


# ============================================================
# Načítanie dát zo Supabase (pôvodné data.py)
# ============================================================
def _s(v):
    return "" if v is None else str(v)


def _cena(v):
    return "" if v is None else f"{float(v):.2f}".replace(".", ",") + " €"


def _den_row(d, dt):
    if not d or d.get("status") != "open":          # sviatok/zatvorené → main() deň preskočí (index [2])
        return [DNI_SK[dt.weekday()], f"{dt.day}.{dt.month}.{dt.year}", "sviatok"] + [""] * 15
    return [
        DNI_SK[dt.weekday()], f"{dt.day}.{dt.month}.{dt.year}",
        _s(d.get("soup1_name")), _s(d.get("soup1_allergens")), "0,33 l", "súčasť menu",
        _s(d.get("soup2_name")), _s(d.get("soup2_allergens")), "0,33 l", "súčasť menu",
        _s(d.get("main1_name")), _s(d.get("main1_allergens")), _s(d.get("main1_portion")), _cena(d.get("main1_price")),
        _s(d.get("main2_name")), _s(d.get("main2_allergens")), _s(d.get("main2_portion")), _cena(d.get("main2_price")),
    ]


def _trvale_row(by_pos):
    row = ["Trvalá ponuka", "", "", "", ""]                                   # [0..4] výplň, kód ich nečíta
    row += ["Vyprážaný rezeň\nzemiakový šalát", "1,3,7", "200/200 g", "8,50 €"]  # [5..8] rezeň, fixný (zalomený)
    for pos in (3, 4, 5, 6):                                                  # [9..24] z DB
        it = by_pos.get(pos, {})
        row += [_s(it.get("name")), _s(it.get("allergens")), _s(it.get("portion")), _cena(it.get("price"))]
    return row


def load_menu(monday=None):
    import requests
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_ANON_KEY"]   # anon stačí – funkcia len číta, RLS to dovoľuje
    head = {"apikey": key, "Authorization": f"Bearer {key}"}

    monday = monday or (date.today() - timedelta(days=date.today().weekday()))
    friday = monday + timedelta(days=4)

    dni = requests.get(
        f"{url}/rest/v1/daily_menus"
        f"?menu_date=gte.{monday}&menu_date=lte.{friday}&order=menu_date.asc",
        headers=head, timeout=10).json()
    trvale = requests.get(
        f"{url}/rest/v1/permanent_menu?order=position.asc", headers=head, timeout=10).json()

    dni = dni if isinstance(dni, list) else []
    trvale = trvale if isinstance(trvale, list) else []

    by_date = {r["menu_date"]: r for r in dni}
    by_pos = {r["position"]: r for r in trvale}
    menu = [_den_row(by_date.get((monday + timedelta(days=i)).isoformat()), monday + timedelta(days=i))
            for i in range(5)]
    menu.append(_trvale_row(by_pos))
    return menu


# ============================================================
# Kreslenie – prenesené z main.py BEZ ZMENY
# (jediná úprava: logo cez join(ASSETS, "logoLUNA.jpg"))
# ============================================================
def template():
    # Draw the rectangle
    c.setFillColor(my_dblue)
    c.roundRect(134, y(217), 327, 32, 6, stroke=0, fill=1)
    c.roundRect(22, y(250), 100, 22, 4, stroke=0, fill=1)
    c.roundRect(22, y(307), 135, 22, 4, stroke=0, fill=1)
    c.roundRect(22, y(441), 215, 22, 4, stroke=0, fill=1)
    c.roundRect(22, y(774), 550, 4, 1, stroke=0, fill=1)
    # cenove ciarky
    c.roundRect(501, y(343.7), 71, 2, 0.5, stroke=0, fill=1)
    c.roundRect(501, y(392), 71, 2, 0.5, stroke=0, fill=1)
    for i in range(5): c.roundRect(501, y(482+(i*55)), 71, 2, 0.5, stroke=0, fill=1)
    #c.roundRect(501, y(699), 71, 2, 0.5, stroke=0, fill=1)

    # logo a nadpisy
    c.drawImage(join(ASSETS, "logoLUNA.jpg"), 167, y(94), width=232.9, height=73.9)

    c.setFont("MyriadBlck", 77)
    c.drawString(50, y(167), "DENNÉ MENU", charSpace=1.7)
    c.setFillColor(my_white)
    c.setFont("MyriadB", 17)
    c.drawString(33, y(245), "POLIEVKA", charSpace=0)
    c.drawString(33, y(302), "HLAVNÉ MENU", charSpace=-0.1)
    c.drawString(33, y(436.3), "TRVALÉ MENU - MINÚTKY", charSpace=-0.1)

    # oznacenie jedal
    c.setFillColor(my_black)
    c.setFont("MyriadBlck", 17)
    c.drawString(129, y(244), "P1", charSpace=0)
    c.drawString(129, y(269), "P2", charSpace=0)
    c.drawString(31.5, y(331), "1.", charSpace=0)
    c.drawString(31.5, y(380), "2.", charSpace=0)
    for i in range(5): c.drawString(31.5, y(467+(i*55)), f"{i+3}.", charSpace=0)
    # AL
    c.setFont("MyriadBolCon", 13)
    c.drawString(175, y(244), "AL:", charSpace=0)
    c.drawString(175, y(269), "AL:", charSpace=0)
    c.drawString(49.5, y(352), "AL:", charSpace=0)
    c.drawString(49.5, y(400), "AL:", charSpace=0)
    for i in range(5): c.drawString(49.5, y(488+(i*55)), "AL:", charSpace=0)
    #c.drawString(79, y(697), "AL:", charSpace=0)

    # spodne texty
    c.setFillColor(my_dblue)
    c.setFont("MyriadBolCon", 16)
    c.drawRightString(567, y(312), "CENA MENU S POLIEVKOU:", charSpace=0.3)
    c.setFont("MyriadB", 17)
    c.drawString(67.5, y(792), "Rozvoz cez BOLT FOOD - nájdete na food.bolt.eu alebo v aplikácii", charSpace=-0.1)
    c.drawString(87, y(763), "Palárikova ulica 89, otváracia doba 9", charSpace=-0.1)
    c.drawString(412, y(763), ", 0907 048 780", charSpace=-0.1)
    # c.drawString(502, y(792), "1", charSpace=-0.1)
    c.drawString(374, y(763), "-13", charSpace=-0.1)
    c.setFont("MyriadB", 12)
    c.drawString(360, y(757), "00", charSpace=0)
    c.drawString(398, y(757), "30", charSpace=0)
    # c.drawString(511, y(786), "00", charSpace=0)
    c.setFillColor(my_black)
    c.setFont("MyriadB", 10)
    c.drawString(245, y(437), "(čas prípravy podľa vyťaženia kuchyne, obvykle do 5 min.)", charSpace=-0.2)
    c.setFont("MyriadB", 13)
    c.drawCentredString(298, y(737), "CENA POLOVIČNEJ PORCIE JE 70%. Pri niektorých jedlách nie je polovičná porcia možná.", charSpace=-0.1)
    c.setFont("MyriadCond", 8.5)
    c.drawCentredString(298, y(807), "Zoznam alergénov: 1. Obilniny obsahujúce lepok (t.j. pšenica, raž, jačmeň, ovos, špalda, kamut alebo ich hybridné odrody). 2. Kôrovce a výrobky z nich. 3. Vajcia a výrobky z nich. 4. Ryby a výrobky z nich. 5. Arašidy a výrobky z nich.", charSpace=-0.2)
    c.drawCentredString(298, y(815), "6. Sójové zrná a výrobkyz nich. 7. Mlieko a výrobky z neho.  8. Orechy, ktorými sú mandle, lieskové orechy, vlašské orechy, kešu, pekanové orechy, para orechy, pistácie, makadanové orechy a queenslandské orechy a výrobky z nich.", charSpace=-0.2)
    c.drawCentredString(298, y(823), "9. Zeler a výrobky z neho. 10. Horčica a výrobky z nej. 11. Sezamové semená a výrobky z nich. 12. Oxid siričitý a siričitany v koncentráciách vyšších ako 10 mg/kg alebo 10 mg/l. 13. Vlčí bôb a výrobky z neho. 14. Mäkkýše a výrobky z nich.", charSpace=-0.25)


def obsah_menu(jedlo, p):
    # den a datum
    c.setFillColor(my_white)
    c.setFont("MyriadB", 27)
    c.drawCentredString(298, y(210), jedlo[p][0].upper() + " " + jedlo[p][1], charSpace=-0.1)
    # rezen
    c.setFillColor(my_black)
    c.setFont("MyriadB", 19)
    c.drawString(255, y(467), "(bravčový alebo kurací),", charSpace=-0.25)
    # c.drawString(110, y(632), "Bravčová panenka alebo kuracinka", charSpace=-0.25)
    # polievky
    c.setFillColor(my_black)
    # c.setFont("MyriadSB", 19)
    # c.drawString(403, y(632), "(na výber)", charSpace=-0.25)
    c.setFont("MyriadSB", 20)
    c.drawString(216, y(244), jedlo[p][2], charSpace=-0.5)
    c.drawString(216, y(269), jedlo[p][6], charSpace=-0.5)
    # menu
    c.drawString(110, y(331), pol(jedlo[p][10], 1), charSpace=-0.25)
    c.drawString(110, y(354), pol(jedlo[p][10], 2), charSpace=-0.25)
    c.drawString(110, y(380), pol(jedlo[p][14], 1), charSpace=-0.25)
    c.drawString(110, y(403), pol(jedlo[p][14], 2), charSpace=-0.25)
    # minutky

    for i in range(5):

            c.drawString(110, y(467+(i*55)), pol(jedlo[5][5+(i*4)], 1), charSpace=-0.25)
            c.drawString(110, y(490+(i*55)), pol(jedlo[5][5+(i*4)], 2), charSpace=-0.25)

        # if i != 3:
        #     c.drawString(110, y(467+(i*55)), pol(jedlo[5][5+(i*4)], 1), charSpace=-0.25)
        #     c.drawString(110, y(490+(i*55)), pol(jedlo[5][5+(i*4)], 2), charSpace=-0.25)
        # if i == 3:
        #     c.drawString(110, y(490+(i*55)), "so slaninkovou omáčkou, dukáty, zelenina", charSpace=-0.25)
    # gramaz hodnota
    c.setFont("MyriadBolCon", 11)
    c.drawString(152, y(244), "0,33 l", charSpace=-0.5)
    c.drawString(152, y(269), "0,33 l", charSpace=-0.5)
    c.setFont("MyriadBolCon", 14)
    c.drawString(49.5, y(331), jedlo[p][12], charSpace=0)
    c.drawString(49.5, y(380), jedlo[p][16], charSpace=-0)
    for i in range(5): c.drawString(49.5, y(467+(i*55)), jedlo[5][7+(i*4)], charSpace=-0)
    # alergeny hodnota
    c.setFont("MyriadBolCon", 12)
    c.drawString(192, y(244), jedlo[p][3], charSpace=-0.5)
    c.drawString(192, y(269), jedlo[p][7], charSpace=-0.5)
    c.drawString(66.5, y(352), jedlo[p][11], charSpace=-0.5)
    c.drawString(66.5, y(400), jedlo[p][15], charSpace=-0.5)
    for i in range(5): c.drawString(66.5, y(488+(i*55)), jedlo[5][6+(i*4)], charSpace=-0.5)
    #c.drawString(94, y(697), jedlo[5][22], charSpace=-0.5)
    # ceny
    c.setFont("MyriadBlck", 18)
    c.drawRightString(567, y(334.5), jedlo[p][13], charSpace=0)
    c.drawRightString(567, y(383), jedlo[p][17], charSpace=0)
    for i in range(5): c.drawRightString(567, y(473+(i*55)), jedlo[5][8+(i*4)], charSpace=0)
    #c.drawRightString(567, y(690), jedlo[5][24], charSpace=0)
    # cena rozvoz
    c.setFont("MyriadBolCon", 12)
    # manuálne upravená cena pre rozvoz
    if jedlo[p][13] == "7,20 €":
        c.drawRightString(567, y(356), "na rozvoz: 8,75 €", charSpace=-0.5)
    else:
        c.drawRightString(567, y(356), "na rozvoz: 8,50 €", charSpace=-0.5)

    c.drawRightString(567, y(404.5), "na rozvoz: 8,50 €", charSpace=-0.5)
    c.drawRightString(567, y(495), "na rozvoz: 9,90 €", charSpace=-0.5)
    c.drawRightString(567, y(550), "na rozvoz: 9,90 €", charSpace=-0.5)
    c.drawRightString(567, y(605), "na rozvoz: 9,90 €", charSpace=-0.5)
    c.drawRightString(567, y(660), "na rozvoz: 9,90 €", charSpace=-0.5)
    c.drawRightString(567, y(715), "na rozvoz: 9,90 €", charSpace=-0.5)


def _draw_day(menu, i):
    """Jeden deň (celá A4 stránka denného menu) na aktuálny canvas."""
    template()
    obsah_menu(menu, i)


# ============================================================
# 1) Denné menu – po jednom dni na stranu (pôvodné správanie)
# ============================================================
def build_pdf(menu) -> bytes:
    global c
    _setup()
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(595, 842), enforceColorSpace="CMYK")
    first = True
    for i in range(5):
        if menu[i][2] == "sviatok":          # zatvorené → deň preskočíme
            continue
        if not first:
            c.showPage()
        _draw_day(menu, i)
        first = False
    c.save()
    return buf.getvalue()


# ============================================================
# 2) 2× denné menu na A4 naležato (dve identické kópie vedľa seba)
# ============================================================
def build_2up(menu) -> bytes:
    global c
    _setup()
    buf = io.BytesIO()
    # A4 naležato; každá kópia = portrétová strana zmenšená na polovicu šírky.
    PW, PH = 842, 595
    s = PH / 842.0                            # mierka: výška 842 → 595 (rovnaký pomer strán)
    half = 595 * s                            # šírka jednej zmenšenej kópie (~420,4)
    c = canvas.Canvas(buf, pagesize=(PW, PH), enforceColorSpace="CMYK")
    first = True
    for i in range(5):
        if menu[i][2] == "sviatok":
            continue
        if not first:
            c.showPage()
        for col in (0, 1):
            c.saveState()
            c.translate(col * half, 0)
            c.scale(s, s)
            _draw_day(menu, i)
            c.restoreState()
        first = False
    c.save()
    return buf.getvalue()


# ============================================================
# 3) Celotýždňový prehľad jedál (textový sumár, vrátane polievky 2)
#    Najprv sa obsah „rozloží" (ops + zvislé pozície), potom sa
#    písmo a riadkovanie rovnomerne zmenší tak, aby vyšiel na 1 stranu.
# ============================================================
def build_overview(menu) -> bytes:
    global c
    _setup()
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(595, 842), enforceColorSpace="CMYK")
    L, R = 40, 555

    # --- 1. rozloženie (base veľkosti, zvislá pozícia = vzdialenosť od vrchu) ---
    ops = []
    cur = [70.0]

    def txt(x, font, size, color, text):
        ops.append(("text", x, font, size, color, cur[0], text))

    def rule(h=0.75):                         # tmavomodrá, polovičná hrúbka
        ops.append(("rule", L, R, cur[0], h))

    def soup(label, name, al):                # názov čierne, objem+alergény ako pri jedlách (menšie tmavomodré)
        ops.append(("soup", L + 12, cur[0], f"{label}   {name}", f"0,33L   ·   AL: {al}"))
        cur[0] += 14

    def wrapped(text, x, font, size, maxw, lh, color):
        lines = [ln for ln in wrap_lines(text, font, size, maxw, 2) if ln != ""] or [""]
        for ln in lines:
            txt(x, font, size, color, ln)
            cur[0] += lh

    # nadpis
    txt(L, "MyriadBlck", 30, my_dblue, "Reštaurácia LUNA"); cur[0] += 18
    txt(L, "MyriadB", 12, my_black, "Týždenný jedálny lístok"); cur[0] += 16
    rule(); cur[0] += 18

    # denné menu (vrátane polievky 2)
    for i in range(5):
        d = menu[i]
        txt(L, "MyriadB", 14, my_dblue, f"{d[0].upper()}  {d[1]}"); cur[0] += 15
        if d[2] == "sviatok":
            txt(L + 12, "MyriadSB", 11.5, my_black, "Zatvorené"); cur[0] += 14
        else:
            soup("P1", d[2], d[3])
            soup("P2", d[6], d[7])
            for num, (name, al, portion, price) in [
                ("1.", (d[10], d[11], d[12], d[13])),
                ("2.", (d[14], d[15], d[16], d[17])),
            ]:
                txt(L + 12, "MyriadB", 11, my_black, num)            # číslo = baseline 1. riadku názvu
                wrapped(name, L + 32, "MyriadSB", 11, R - (L + 32), 13, my_black)
                txt(L + 32, "MyriadBolCon", 10.5, my_dblue, f"{portion}   ·   AL: {al}   ·   {price}")
                cur[0] += 15
        rule(); cur[0] += 14

    # trvalé menu (bez druhej čiary – ostáva len čiara pod denným menu)
    cur[0] += 6
    txt(L, "MyriadB", 14, my_dblue, "TRVALÉ MENU – MINÚTKY"); cur[0] += 16
    tr = menu[5]
    for k in range(5):
        name = (tr[5 + k * 4] or "").replace("\n", ", ")
        al, portion, price = tr[6 + k * 4], tr[7 + k * 4], tr[8 + k * 4]
        txt(L + 12, "MyriadB", 11, my_black, f"{k + 3}.")
        wrapped(name, L + 32, "MyriadSB", 11, R - (L + 32), 13, my_black)
        txt(L + 32, "MyriadBolCon", 10.5, my_dblue, f"{portion}   ·   AL: {al}   ·   {price}")
        cur[0] += 16

    # --- 2. mierka tak, aby spodok obsahu nepresiahol stranu (max 1.0) ---
    total = cur[0]
    s = min(1.0, 822.0 / total)               # 822 ≈ spodný okraj (~20 px rezerva)

    # --- 3. vykreslenie (písmo aj zvislé pozície × s, x ostáva) ---
    for op in ops:
        if op[0] == "text":
            _, x, font, size, color, top, text = op
            c.setFillColor(color)
            c.setFont(font, size * s)
            c.drawString(x, y(top * s), text)
        elif op[0] == "soup":
            _, x, top, prefix, meta = op
            yy = y(top * s)
            c.setFillColor(my_black)
            c.setFont("MyriadSB", 11 * s)
            c.drawString(x, yy, prefix)
            w = stringWidth(prefix, "MyriadSB", 11 * s)
            c.setFillColor(my_dblue)
            c.setFont("MyriadBolCon", 10.5 * s)
            c.drawString(x + w + 8 * s, yy, meta)
        else:                                 # rule – tmavomodrá, polovičná hrúbka
            _, x0, x1, top, h = op
            c.setFillColor(my_dblue)
            c.roundRect(x0, y(top * s), x1 - x0, h, h / 2, stroke=0, fill=1)

    c.save()
    return buf.getvalue()


# ============================================================
# 4) Celotýždňový prehľad na A3 naležato:
#    dni v dvoch stĺpcoch × 3 riadkoch vľavo, trvalá ponuka ako
#    samostatný blok vpravo, vo voľnej bunke info s alergénmi.
#    Písmo sa iteratívne nastaví tak, aby dni presne vyplnili výšku
#    strany (plakátová veľkosť), zvyšné miesto sa rozdelí v bunkách.
#    Výška A3 naležato = 842 bodov (ako A4 na výšku), takže y() platí.
# ============================================================
ALERGENY_TXT = (
    "1. Obilniny obsahujúce lepok. 2. Kôrovce. 3. Vajcia. 4. Ryby. 5. Arašidy. 6. Sójové zrná. "
    "7. Mlieko. 8. Orechy. 9. Zeler. 10. Horčica. 11. Sezamové semená. 12. Oxid siričitý a siričitany. "
    "13. Vlčí bôb. 14. Mäkkýše – a výrobky z nich."
)


def build_overview_a3(menu) -> bytes:
    global c
    _setup()
    buf = io.BytesIO()
    PW, PH = 1191, 842
    c = canvas.Canvas(buf, pagesize=(PW, PH), enforceColorSpace="CMYK")

    L, R = 45, PW - 45
    TOP, BOTTOM = 152, 812                 # zvislý rozsah obsahu pod hlavičkou
    GAP, RGAP = 36, 18                     # medzera medzi stĺpcami / riadkami
    BLOCK_W = 340                          # blok trvalej ponuky vpravo
    BLOCK_X = R - BLOCK_W
    COLW = (BLOCK_X - GAP - L - GAP) / 2.0

    # hlavička: názov vľavo, vedľa neho rozsah týždňa (dátumy z pondelka a piatka)
    c.setFillColor(my_dblue)
    c.setFont("MyriadBlck", 48)
    c.drawString(L, y(97), "Reštaurácia LUNA")
    hw = stringWidth("Reštaurácia LUNA", "MyriadBlck", 48)
    c.setFont("MyriadB", 23)
    c.drawString(L + hw + 34, y(97), f"Denné menu pre týždeň od {menu[0][1]} do {menu[4][1]}")
    c.roundRect(L, y(118), R - L, 3, 1.5, stroke=0, fill=1)

    def wrap_all(text, font, size, maxw):
        """Zalomenie bez limitu riadkov (wrap_lines má strop a zvyšok napchá do posledného)."""
        out, cur = [], ""
        for word in (text or "").split():
            test = (cur + " " + word).strip()
            if cur and stringWidth(test, font, size) > maxw:
                out.append(cur)
                cur = word
            else:
                cur = test
        out.append(cur)
        return out

    def meal(x, top, num, name, al, portion, price, w, s, draw):
        """Jedno jedlo: číslo + zalomený názov + riadok porcia/alergény/cena.
        Vráti novú zvislú pozíciu; pri draw=False iba počíta výšku."""
        size = 18.5 * s
        lines = wrap_all(name, "MyriadSB", size, w - 32 * s)    # bez stropu riadkov, nech nič nepreteká
        if draw:
            c.setFillColor(my_black)
            c.setFont("MyriadB", size)
            c.drawString(x, y(top), num)
            c.setFont("MyriadSB", size)
            for k, ln in enumerate(lines):
                c.drawString(x + 32 * s, y(top + k * 21 * s), ln)
        top += len(lines) * 21 * s
        if draw:
            c.setFillColor(my_dblue)
            c.setFont("MyriadBolCon", 15 * s)
            c.drawString(x + 32 * s, y(top), f"{portion}   ·   AL: {al}   ·   {price}")
        return top + 21 * s

    def day_cell(x, top, d, s, draw, pad=0.0):
        """Deň = modrá lišta s názvom + polievky + 2 jedlá. Vráti výšku bunky.
        `pad` = extra rozostup medzi skupinami, ktorým sa bunka dorovná na výšku riadka."""
        y0, bar = top, 32 * s
        if draw:
            c.setFillColor(my_dblue)
            c.roundRect(x, y(top + bar), COLW, bar, 5, stroke=0, fill=1)
            c.setFillColor(my_white)
            c.setFont("MyriadB", 20 * s)
            c.drawString(x + 12 * s, y(top + bar - 9.5 * s), f"{d[0].upper()}   {d[1]}")
        top += bar + 26 * s + pad

        if d[2] == "sviatok":
            if draw:
                c.setFillColor(my_black)
                c.setFont("MyriadSB", 18.5 * s)
                c.drawString(x + 4 * s, y(top), "Zatvorené")
            return top + 21 * s - y0

        for label, name, al in (("P1", d[2], d[3]), ("P2", d[6], d[7])):
            size, mw = 18.5 * s, COLW - 8 * s
            prefix, meta = f"{label}   {name}", f"0,33L   ·   AL: {al}"
            need_w = stringWidth(prefix, "MyriadSB", size) + 10 * s + stringWidth(meta, "MyriadBolCon", 15 * s)
            f = 1.0 if need_w <= mw else mw / need_w          # mierne dlhší riadok radšej stlačíme
            if f >= 0.82:                                     # názov + objem/alergény na jednom riadku
                if draw:
                    c.setFillColor(my_black)
                    c.setFont("MyriadSB", size * f)
                    c.drawString(x + 4 * s, y(top), prefix)
                    c.setFillColor(my_dblue)
                    c.setFont("MyriadBolCon", 15 * s * f)
                    c.drawString(x + 4 * s + stringWidth(prefix, "MyriadSB", size * f) + 10 * s, y(top), meta)
                top += 23 * s
            else:                                             # veľmi dlhý názov – zalomiť, meta pod názov
                lines = wrap_all(prefix, "MyriadSB", size, mw)
                if draw:
                    c.setFillColor(my_black)
                    c.setFont("MyriadSB", size)
                    for k, ln in enumerate(lines):
                        c.drawString(x + 4 * s, y(top + k * 23 * s), ln)
                    c.setFillColor(my_dblue)
                    c.setFont("MyriadBolCon", 15 * s)
                    c.drawString(x + 4 * s, y(top + len(lines) * 23 * s), meta)
                top += (len(lines) + 1) * 23 * s
        top += 6 * s + pad

        top = meal(x, top, "1.", d[10], d[11], d[12], d[13], COLW, s, draw) + pad
        top = meal(x, top, "2.", d[14], d[15], d[16], d[17], COLW, s, draw)
        return top - y0

    def block_frame(x, top, w, h, title, s):
        """Rámik so zaoblenými rohmi + modrá hlavička s bielym nadpisom. Vráti spodok hlavičky."""
        bar = 34 * s
        c.setFillColor(my_dblue)
        c.setStrokeColor(my_dblue)
        c.setLineWidth(1.5)
        c.roundRect(x, y(top + h), w, h, 8, stroke=1, fill=0)
        c.roundRect(x, y(top + bar), w, bar, 8, stroke=0, fill=1)
        c.setFillColor(my_white)
        c.setFont("MyriadB", 20 * s)
        c.drawCentredString(x + w / 2, y(top + bar - 11 * s), title)
        return top + bar

    def trvale_block(s):
        """Blok vpravo cez celú výšku obsahu; má vlastnú mierku, aby stĺpec vyplnil."""
        head = block_frame(BLOCK_X, TOP, BLOCK_W, BOTTOM - TOP, "TRVALÁ PONUKA – MINÚTKY", s)
        tr = menu[5]
        items = [((tr[5 + k * 4] or "").replace("\n", ", "), tr[6 + k * 4], tr[7 + k * 4], tr[8 + k * 4])
                 for k in range(5)]
        x, w = BLOCK_X + 18, BLOCK_W - 36
        start = head + 30 * s
        room = (BOTTOM - 24) - start

        def need(sb):
            t = 0.0
            for name, al, portion, price in items:              # nasucho: koľko miesta treba
                t = meal(x, t, "", name, al, portion, price, w, sb, False)
            return t

        sb = s
        for _ in range(5):                                      # + rezerva na rozostupy medzi položkami
            sb = min(1.2 * s, sb * room / (need(sb) + len(items) * 13 * sb))
        pad = max(0.0, (room - need(sb)) / len(items))
        top = start
        for i, (name, al, portion, price) in enumerate(items):
            top = meal(x, top, f"{i + 3}.", name, al, portion, price, w, sb, True) + pad

    def info_block(x, top, h, s):
        """Voľná bunka mriežky: poznámky k cenám/rozvozu + zoznam alergénov."""
        top = block_frame(x, top, COLW, h, "INFORMÁCIE", s) + 26 * s
        c.setFillColor(my_black)
        for note in (
            "Cena polovičnej porcie je 70 %. Pri niektorých jedlách nie je polovičná porcia možná.",
            "Rozvoz cez BOLT FOOD – nájdete na food.bolt.eu alebo v aplikácii.",
            "Palárikova ulica 89 · otváracia doba 9:00 – 13:30 · 0907 048 780",
        ):
            for ln in wrap_all(note, "MyriadSB", 14 * s, COLW - 36):
                c.setFont("MyriadSB", 14 * s)
                c.drawString(x + 18, y(top), ln)
                top += 17 * s
            top += 5 * s
        c.setFillColor(my_dblue)
        c.setFont("MyriadB", 12.5 * s)
        c.drawString(x + 18, y(top), "Zoznam alergénov:")
        top += 15 * s
        c.setFillColor(my_black)
        c.setFont("MyriadCond", 11 * s)
        for ln in wrap_all(ALERGENY_TXT, "MyriadCond", 11 * s, COLW - 36):
            c.drawString(x + 18, y(top), ln)
            top += 12.5 * s

    # --- mierka: dni musia zaplniť výšku strany; iterujeme, lebo veľkosť mení zalomenie ---
    def rows_need(s):
        h = [day_cell(0, 0, menu[i], s, False) for i in range(5)]
        return [max(h[0], h[1]), max(h[2], h[3]), h[4]]

    avail = BOTTOM - TOP - 2 * RGAP
    s = 1.0
    for _ in range(4):
        s = min(1.35, s * avail / sum(rows_need(s)))
    for _ in range(8):                                           # poistka: mierka už len klesá, kým sa obsah nezmestí
        if sum(rows_need(s)) <= avail:
            break
        s *= 0.97
    need = rows_need(s)
    extra = (avail - sum(need)) / 3.0                            # zvyšok rovnomerne do riadkov
    row_h = [n + extra for n in need]
    row_top = [TOP, TOP + row_h[0] + RGAP, TOP + row_h[0] + row_h[1] + 2 * RGAP]

    for i in range(5):
        row, col = divmod(i, 2)
        x = L + col * (COLW + GAP)
        pad = min(18 * s, max(0.0, (row_h[row] - day_cell(0, 0, menu[i], s, False)) / 4))
        day_cell(x, row_top[row], menu[i], s, True, pad)
    info_block(L + COLW + GAP, row_top[2], row_h[2], s)          # voľná bunka vedľa piatka
    trvale_block(s)

    c.save()
    return buf.getvalue()


_BUILDERS = {
    "menu": (build_pdf, "Luna_menu.pdf"),
    "stoly": (build_2up, "Luna_stoly.pdf"),
    "prehlad": (build_overview, "Luna_prehlad.pdf"),
    "prehlad_a3": (build_overview_a3, "Luna_prehlad_A3.pdf"),
}

# Verejný Supabase Storage bucket + fixný názov súboru pre web lunacadca.sk.
# Verejný odkaz potom vždy: {SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{OBJECT}
PUBLISH_BUCKET = os.environ.get("MENU_PDF_BUCKET", "menu")
PUBLISH_OBJECT = "LUNA_menu.pdf"


def publish_menu_pdf(pdf: bytes):
    """Nahrá denné menu do verejného Supabase Storage bucketu (upsert).
    Zámerne potichu – ak upload zlyhá, sťahovanie v prehliadači sa nesmie pokaziť."""
    import requests
    url = os.environ["SUPABASE_URL"]
    # na zápis treba service_role kľúč (anon má len čítanie); fallback na anon ak nie je
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_ANON_KEY"]
    requests.post(
        f"{url}/storage/v1/object/{PUBLISH_BUCKET}/{PUBLISH_OBJECT}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/pdf",
            "x-upsert": "true",                 # prepíše existujúci súbor
            "cache-control": "max-age=300",     # CDN drží max 5 min → web sa obnoví rýchlo
        },
        data=pdf, timeout=15,
    ).raise_for_status()


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            qs = parse_qs(urlparse(self.path).query)
            week = qs.get("week", [None])[0]                 # 'YYYY-MM-DD' (pondelok), inak aktuálny týždeň
            doc = qs.get("doc", ["menu"])[0]                 # 'menu' | 'stoly' | 'prehlad'
            build, fname = _BUILDERS.get(doc, _BUILDERS["menu"])
            monday = date.fromisoformat(week) if week else None
            pdf = build(load_menu(monday))
            if doc == "menu":                    # denné menu zverejníme aj na web
                try:
                    publish_menu_pdf(pdf)
                except Exception as pub_err:
                    print(f"[publish] upload zlyhal: {pub_err}")
            self.send_response(200)
            self.send_header("Content-Type", "application/pdf")
            self.send_header("Content-Disposition", f'attachment; filename="{fname}"')
            self.end_headers()
            self.wfile.write(pdf)
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.send_response(500)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(f"PDF zlyhalo: {e}".encode("utf-8"))
