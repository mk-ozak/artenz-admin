# api/generate-pdf.py – Vercel Python serverless funkcia
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from os.path import dirname, abspath, join
from datetime import date
import io

from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import CMYKColor

from data import load_menu          # vedľa tohto súboru
from my_functions import y, pol     # s opraveným pol()

DIR = dirname(abspath(__file__))
ASSETS = join(DIR, "assets")        # fonty + logo

pdfmetrics.registerFont(TTFont("MyriadSB",     join(ASSETS, "MyriadPro-Semibold.ttf")))
pdfmetrics.registerFont(TTFont("MyriadB",      join(ASSETS, "MyriadPro-Bold.ttf")))
pdfmetrics.registerFont(TTFont("MyriadBlck",   join(ASSETS, "MyriadPro-Black.ttf")))
pdfmetrics.registerFont(TTFont("MyriadBolCon", join(ASSETS, "MyriadPro-BoldCond.ttf")))
pdfmetrics.registerFont(TTFont("MyriadCond",   join(ASSETS, "MyriadPro-Cond.ttf")))

my_black = CMYKColor(0, 0, 0, 1)
my_dblue = CMYKColor(0.40, 0.19, 0, 0.64)
my_white = CMYKColor(0, 0, 0, 0)

c = None  # plátno – nastaví build_pdf; template()/obsah_menu() ho čítajú ako globál


# --- prenesené z main.py BEZ ZMENY (okrem cesty k logu cez join(ASSETS, ...)) ---
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
# --- koniec preneseného kódu ---


def build_pdf(menu) -> bytes:
    global c
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(595, 842), enforceColorSpace="CMYK")
    for i in range(5):
        if menu[i][2] != "sviatok":
            template()
            obsah_menu(menu, i)
            if i != 4:
                c.showPage()
    c.save()
    return buf.getvalue()


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            qs = parse_qs(urlparse(self.path).query)
            week = qs.get("week", [None])[0]                 # 'YYYY-MM-DD' (pondelok), inak aktuálny týždeň
            monday = date.fromisoformat(week) if week else None
            pdf = build_pdf(load_menu(monday))
            self.send_response(200)
            self.send_header("Content-Type", "application/pdf")
            self.send_header("Content-Disposition", 'attachment; filename="Luna_menu.pdf"')
            self.end_headers()
            self.wfile.write(pdf)
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.send_response(500)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(f"PDF zlyhalo: {e}".encode("utf-8"))
