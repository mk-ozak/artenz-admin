# data.py – načítanie menu zo Supabase pre generovanie PDF
import os
import requests
from datetime import date, timedelta

DNI_SK = ["pondelok", "utorok", "streda", "štvrtok", "piatok", "sobota", "nedeľa"]


def _s(v):
    return "" if v is None else str(v)


def _cena(v):
    return "" if v is None else f"{float(v):.2f}".replace(".", ",") + " €"


def _den_row(d, dt):
    """Plochý zoznam s indexmi, aké očakáva obsah_menu()."""
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
    # [5..8] = rezeň, FIXNÝ (zlúčený bravčový + kurací) – nereaguje na zmeny v admine
    row = ["Trvalá ponuka", "", "", "", ""]                                   # [0..4] výplň, kód ich nečíta
    row += ["Vyprážaný rezeň zemiakový šalát", "1,3,7", "200/200 g", "8,50 €"]
    for pos in (3, 4, 5, 6):                                                  # syr, prsia, wrap, panenka – z DB
        it = by_pos.get(pos, {})
        row += [_s(it.get("name")), _s(it.get("allergens")), _s(it.get("portion")), _cena(it.get("price"))]
    return row


def load_menu(monday=None):
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
