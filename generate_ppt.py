#!/usr/bin/env python3
# Generador de Presentación Formal - Voluntariado Cívico Electoral
# Usa python-pptx y las imágenes extraídas del PDF original

from pptx import Presentation
from pptx.util import Inches, Emu, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_AUTO_SIZE
from pptx.enum.shapes import MSO_SHAPE
import os

# Configuración
ASSETS = "ppt_assets"
OUTPUT_FORMAL = "Presentacion_Voluntariado_Civico_Electoral.pptx"
OUTPUT_FIEL = "Presentacion_VCE_Original_Fiel.pptx"

# Colores institucionales TSE
BLUE_DARK = RGBColor(10, 47, 92)      # #0A2F5C
BLUE_MED = RGBColor(0, 82, 155)       # #00529B
BLUE_MEDIUM = RGBColor(0, 102, 179)   # #0066B3
BLUE_LIGHT = RGBColor(0, 136, 204)    # #0088CC
BLUE_CYAN = RGBColor(75, 192, 200)    # acento
WHITE = RGBColor(255,255,255)
BLACK = RGBColor(0,0,0)
GRAY_LIGHT = RGBColor(240,240,240)

def add_background(slide, color):
    background = slide.background
    fill = background.fill
    fill.solid()
    fill.fore_color.rgb = color

def add_shape_bg(slide, left, top, width, height, fill_color, alpha=None):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    shape.line.fill.background()
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_color
    return shape

def add_text_box(slide, left, top, width, height, text, font_size=18, bold=False, color=WHITE, alignment=PP_ALIGN.LEFT, font_name="Calibri"):
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.bold = bold
    p.font.color.rgb = color
    p.font.name = font_name
    p.alignment = alignment
    return txBox

def add_paragraph(text_frame, text, font_size=16, bold=False, color=WHITE, space_after=Pt(6), alignment=PP_ALIGN.LEFT, font_name="Calibri"):
    p = text_frame.add_paragraph()
    p.text = text
    p.font.size = Pt(font_size)
    p.font.bold = bold
    p.font.color.rgb = color
    p.font.name = font_name
    p.space_after = space_after
    p.alignment = alignment
    return p

def add_footer(slide, include_tse=True):
    # Barra inferior azul
    footer_bg = add_shape_bg(slide, Inches(0), Inches(6.9), Inches(13.33), Inches(0.6), BLUE_MED)
    # Logo TSE pequeño abajo izquierda
    tse_logo_path = os.path.join(ASSETS, "page1_img1_6.png")
    if include_tse and os.path.exists(tse_logo_path):
        # fondo blanco para logo
        add_shape_bg(slide, Inches(0), Inches(6.9), Inches(3.5), Inches(0.6), RGBColor(245, 240, 230))
        # diagonal effect simulated with shape
        try:
            slide.shapes.add_picture(tse_logo_path, Inches(0.3), Inches(6.92), Inches(1.2), Inches(0.5))
        except:
            pass
        # Texto footer
        add_text_box(slide, Inches(1.6), Inches(6.92), Inches(1.8), Inches(0.5),
                     "TRIBUNAL SUPREMO ELECTORAL\nGUATEMALA, C.A.", font_size=7, bold=True, color=BLUE_MED, alignment=PP_ALIGN.LEFT)
    # Texto derecha
    add_text_box(slide, Inches(8.5), Inches(6.95), Inches(4.5), Inches(0.5),
                 "Voluntariado Cívico Electoral", font_size=14, bold=True, color=WHITE, alignment=PP_ALIGN.RIGHT)

def add_logo_vce(slide, top_right=True):
    # Logo Voluntariado Cívico (manos)
    logo_path = os.path.join(ASSETS, "page3_img6_28.jpeg")  # logo circular manos
    # Try alternative if not exist
    if not os.path.exists(logo_path):
        logo_path = os.path.join(ASSETS, "page4_img3_42.png")
    if os.path.exists(logo_path):
        if top_right:
            slide.shapes.add_picture(logo_path, Inches(11.8), Inches(0.2), Inches(1.2), Inches(1.2))
        else:
            slide.shapes.add_picture(logo_path, Inches(0.5), Inches(0.2), Inches(1.2), Inches(1.2))

def create_formal_presentation():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # === SLIDE 1: PORTADA TRIBUNAL ===
    slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank
    add_background(slide, WHITE)
    # Logo central grande
    logo_tse = os.path.join(ASSETS, "page1_img1_6.png")
    if os.path.exists(logo_tse):
        slide.shapes.add_picture(logo_tse, Inches(5), Inches(1), Inches(3.3), Inches(1.9))
    add_text_box(slide, Inches(1), Inches(3.2), Inches(11.3), Inches(0.8),
                 "TRIBUNAL SUPREMO ELECTORAL", font_size=28, bold=True, color=BLUE_MED, alignment=PP_ALIGN.CENTER)
    add_text_box(slide, Inches(1), Inches(3.9), Inches(11.3), Inches(0.5),
                 "GUATEMALA, C.A.", font_size=20, bold=False, color=BLUE_MED, alignment=PP_ALIGN.CENTER)
    # Línea
    add_shape_bg(slide, Inches(5.5), Inches(4.6), Inches(2.3), Pt(3), BLUE_MED)
    add_text_box(slide, Inches(1), Inches(4.8), Inches(11.3), Inches(0.8),
                 "Voluntariado Cívico Electoral", font_size=26, bold=True, color=BLUE_DARK, alignment=PP_ALIGN.CENTER)
    add_text_box(slide, Inches(1), Inches(5.6), Inches(11.3), Inches(0.5),
                 "Presentación Institucional Formal", font_size=14, bold=False, color=RGBColor(100,100,100), alignment=PP_ALIGN.CENTER)

    # === SLIDE 2: PORTADA VOLUNTARIADO ===
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, BLUE_DARK)
    # Imagen fondo original page3
    bg_img = os.path.join(ASSETS, "page3_img1_13.jpeg")
    if os.path.exists(bg_img):
        slide.shapes.add_picture(bg_img, Inches(0), Inches(0), Inches(13.33), Inches(7.5))
        # Overlay azul semitransparente con shape
        overlay = add_shape_bg(slide, Inches(0), Inches(0), Inches(13.33), Inches(7.5), BLUE_DARK)
        # pptx no soporta transparencia directa fácil, usamos fill con alpha via low-level? simplificamos dejando overlay pero con imagen detrás se verá
        # Hacemos un rectángulo azul con transparencia simulada poniendo otro shape encima con 40% 
        # En pptx no hay alpha simple, así que ponemos un shape con color y usamos segundo plano
    # Re-agregar fondo azul con transparencia usando picture fill? Para simplicidad, añadimos rectángulo azul semitransparente con shape y texto encima
    # Quitamos overlay anterior y ponemos uno nuevo más sutil
    # Texto principal
    add_logo_vce(slide, top_right=True)
    add_text_box(slide, Inches(0.5), Inches(1.5), Inches(12), Inches(1.2),
                 "TU VOZ Y TU PARTICIPACIÓN\nTRANSFORMAN", font_size=36, bold=True, color=WHITE, alignment=PP_ALIGN.CENTER)
    add_text_box(slide, Inches(0.5), Inches(3.5), Inches(12), Inches(1),
                 "¡ÚNETE AL VOLUNTARIADO CÍVICO ELECTORAL!", font_size=22, bold=True, color=WHITE, alignment=PP_ALIGN.CENTER)
    add_footer(slide)

    # === SLIDE 3: ¿SABÍAS QUE? ===
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, BLUE_DARK)
    add_shape_bg(slide, Inches(0), Inches(0), Inches(13.33), Inches(7.5), BLUE_DARK)
    # Gradiente simulado con shapes
    add_shape_bg(slide, Inches(4), Inches(0), Inches(9.33), Inches(7.5), BLUE_MED)
    add_text_box(slide, Inches(0.5), Inches(0.5), Inches(5), Inches(1),
                 "¿SABÍAS QUE...?", font_size=32, bold=True, color=WHITE, alignment=PP_ALIGN.LEFT)
    # Texto
    tx = slide.shapes.add_textbox(Inches(0.5), Inches(1.8), Inches(5.5), Inches(3)).text_frame
    tx.word_wrap = True
    p = tx.paragraphs[0]
    p.text = "Mediante el Acuerdo 297-2011, se creó la Red de Voluntariados Electorales para promover y fortalecer la participación ciudadana en la juventud guatemalteca."
    p.font.size = Pt(18)
    p.font.color.rgb = WHITE
    p.font.name = "Calibri"
    p.space_after = Pt(12)
    add_paragraph(tx, "💡 ¡Tu voz sí hace la diferencia!", font_size=20, bold=True, color=RGBColor(255, 230, 100))
    # Imagen del acuerdo
    acuerdo_img = os.path.join(ASSETS, "page4_img5_44.png")
    if os.path.exists(acuerdo_img):
        slide.shapes.add_picture(acuerdo_img, Inches(7), Inches(0.5), Inches(5.5), Inches(5.5))
    add_logo_vce(slide)
    add_footer(slide)

    # === SLIDE 4: ¿QUÉ ES EL VCE? ===
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, BLUE_DARK)
    add_shape_bg(slide, Inches(0), Inches(0), Inches(5.5), Inches(7.5), RGBColor(10, 35, 75))
    add_shape_bg(slide, Inches(5), Inches(0), Inches(8.33), Inches(7.5), BLUE_MED)
    # Diagonal cyan accent
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(5), Inches(0.5), Inches(0.5), Inches(6))
    shape.rotation = 15
    shape.fill.solid()
    shape.fill.fore_color.rgb = BLUE_CYAN
    shape.line.fill.background()

    add_text_box(slide, Inches(0.5), Inches(0.3), Inches(5), Inches(1.2),
                 "¿QUÉ ES EL VOLUNTARIADO\nCÍVICO ELECTORAL?", font_size=24, bold=True, color=WHITE, alignment=PP_ALIGN.LEFT)
    # Bullets
    tx = slide.shapes.add_textbox(Inches(0.5), Inches(1.8), Inches(5), Inches(4.5)).text_frame
    tx.word_wrap = True
    bullets = [
        "Es un programa impulsado por el Tribunal Supremo Electoral, que busca fortalecer la participación ciudadana y la formación cívica en la juventud guatemalteca.",
        "Se conforma por jóvenes, comprometidos con la construcción de una sociedad más justa, inclusiva y democrática.",
        "Este voluntariado se sustenta en valores democráticos como el respeto, la responsabilidad, la equidad, la solidaridad, la honestidad, la transparencia y el compromiso ciudadano."
    ]
    for i, b in enumerate(bullets):
        if i==0:
            p = tx.paragraphs[0]
            p.text = f"• {b}"
        else:
            p = tx.add_paragraph()
            p.text = f"• {b}"
        p.font.size = Pt(14)
        p.font.color.rgb = WHITE
        p.font.name = "Calibri"
        p.space_after = Pt(12)

    # Imágenes originales
    img1 = os.path.join(ASSETS, "page5_img1_63.jpeg")
    img2 = os.path.join(ASSETS, "page5_img3_65.jpeg")
    img3 = os.path.join(ASSETS, "page5_img4_66.jpeg")
    img4 = os.path.join(ASSETS, "page5_img10_70.jpeg")
    # Layout imágenes
    if os.path.exists(img1):
        slide.shapes.add_picture(img1, Inches(6), Inches(0.5), Inches(7), Inches(3.5))
    if os.path.exists(img2):
        slide.shapes.add_picture(img2, Inches(6.2), Inches(3.2), Inches(2), Inches(1.8))
    if os.path.exists(img3):
        slide.shapes.add_picture(img3, Inches(8.5), Inches(3.2), Inches(2), Inches(1.8))
    if os.path.exists(img4):
        slide.shapes.add_picture(img4, Inches(10.8), Inches(3.2), Inches(2), Inches(1.8))
    # Círculos decorativos con imágenes del PDF original recortadas
    add_footer(slide)
    add_logo_vce(slide)

    # === SLIDE 5: CRECIMIENTO ===
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, BLUE_DARK)
    add_text_box(slide, Inches(0.5), Inches(0.2), Inches(12), Inches(1),
                 "VCE: 2011-2023, MÁS DE UNA DÉCADA DE CRECIMIENTO", font_size=28, bold=True, color=WHITE, alignment=PP_ALIGN.CENTER)
    # Tabla de crecimiento
    # Imagen del gráfico original como referencia fiel
    grafico_original = os.path.join(ASSETS, "page6_render.png")
    if os.path.exists(grafico_original):
        slide.shapes.add_picture(grafico_original, Inches(0.5), Inches(1.2), Inches(12.3), Inches(5))
    # Si queremos recrear con datos:
    # Datos: 2011-2000, 2015-4200, 2018-8409, 2019-9442, 2023-12000
    add_footer(slide)

    # === SLIDE 6: ¿QUIÉNES PUEDEN SER? ===
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, WHITE)
    add_shape_bg(slide, Inches(0), Inches(0), Inches(4.5), Inches(7.5), BLUE_DARK)
    # Imagen izquierda
    img_who = os.path.join(ASSETS, "page7_img1_105.jpeg")
    if os.path.exists(img_who):
        slide.shapes.add_picture(img_who, Inches(0), Inches(0), Inches(4.5), Inches(6.9))
    add_text_box(slide, Inches(4.8), Inches(0.3), Inches(8), Inches(1),
                 "¿QUIÉNES PUEDEN SER VOLUNTARIOS/AS?", font_size=26, bold=True, color=BLUE_DARK, alignment=PP_ALIGN.LEFT)
    tx = slide.shapes.add_textbox(Inches(4.8), Inches(1.5), Inches(8), Inches(5)).text_frame
    tx.word_wrap = True
    p = tx.paragraphs[0]
    p.text = "El Voluntariado Cívico Electoral está abierto a jóvenes, idealmente entre 18 y 30 años."
    p.font.size = Pt(16)
    p.font.color.rgb = BLACK
    p.font.name = "Calibri"
    p.space_after = Pt(12)
    p.font.bold = False
    items = [
        "Tengan actitud de servicio y compromiso con su comunidad.",
        "Que impulsen soluciones sociales y promuevan la cultura de paz.",
        "Respeten la diversidad y a todas las personas sin prejuicios.",
        "Dispongan de tiempo para participar en las actividades cuando sean convocados.",
        "Desean aprender, crecer y aportar con entusiasmo.",
        "Se identifiquen con los valores del Tribunal Supremo Electoral."
    ]
    for it in items:
        pp = tx.add_paragraph()
        pp.text = f"• {it}"
        pp.font.size = Pt(14)
        pp.font.color.rgb = RGBColor(50,50,50)
        pp.font.name = "Calibri"
        pp.space_after = Pt(6)
    add_footer(slide)

    # === SLIDE 7: FUNCIONES ===
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, BLUE_MED)
    # Imagen izquierda
    img_func = os.path.join(ASSETS, "page8_img1_66.jpeg")
    if os.path.exists(img_func):
        slide.shapes.add_picture(img_func, Inches(0), Inches(0), Inches(5.5), Inches(6.9))
    add_text_box(slide, Inches(5.8), Inches(0.3), Inches(7), Inches(1),
                 "PRINCIPALES FUNCIONES DEL VCE", font_size=26, bold=True, color=WHITE, alignment=PP_ALIGN.LEFT)
    tx = slide.shapes.add_textbox(Inches(5.8), Inches(1.5), Inches(7), Inches(4.5)).text_frame
    tx.word_wrap = True
    funcs = [
        "Impulsar la participación ciudadana, especialmente en el segmento joven de la población.",
        "Informar y orientar a la ciudadanía votante en los procesos electorales.",
        "Brindar asistencia a las personas que requieren asistencia y acompañamiento el día de las votaciones.",
        "Ser agentes multiplicadores de información oficial del TSE."
    ]
    for i, f in enumerate(funcs):
        if i==0:
            p = tx.paragraphs[0]
            p.text = f"• {f}"
        else:
            p = tx.add_paragraph()
            p.text = f"• {f}"
        p.font.size = Pt(15)
        p.font.color.rgb = WHITE
        p.font.name = "Calibri"
        p.space_after = Pt(14)
    add_footer(slide)
    add_logo_vce(slide)

    # === SLIDE 8: ACTIVIDADES NO ELECTORAL ===
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, BLUE_DARK)
    add_text_box(slide, Inches(0.5), Inches(0.3), Inches(12), Inches(1.2),
                 "¿QUÉ ACTIVIDADES SE DESARROLLAN EN TIEMPO NO ELECTORAL?", font_size=24, bold=True, color=WHITE, alignment=PP_ALIGN.CENTER)
    # Imagen
    img_no = os.path.join(ASSETS, "page9_img2_132.jpeg")
    if os.path.exists(img_no):
        slide.shapes.add_picture(img_no, Inches(0.5), Inches(1.8), Inches(4.5), Inches(4))
    tx = slide.shapes.add_textbox(Inches(6), Inches(1.8), Inches(6.5), Inches(4.5)).text_frame
    tx.word_wrap = True
    acts = [
        "Formación cívica electoral permanente",
        "Acompañamiento en las campañas de empadronamiento",
        "Producciones de audiovisuales para fomentar la participación de la juventud",
        "Divulgación en Redes Sociales para promover las actividades del TSE"
    ]
    for i, a in enumerate(acts):
        if i==0:
            p = tx.paragraphs[0]
            p.text = f"• {a}"
        else:
            p = tx.add_paragraph()
            p.text = f"• {a}"
        p.font.size = Pt(16)
        p.font.color.rgb = WHITE
        p.font.name = "Calibri"
        p.space_after = Pt(12)
    add_footer(slide)
    add_logo_vce(slide)

    # === SLIDE 9: ACTIVIDADES TIEMPO ELECTORAL ===
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, BLUE_DARK)
    add_text_box(slide, Inches(0.5), Inches(0.3), Inches(12), Inches(1),
                 "¿QUÉ ACTIVIDADES SE DESARROLLAN EN TIEMPO ELECTORAL?", font_size=24, bold=True, color=WHITE, alignment=PP_ALIGN.CENTER)
    # Antes
    add_shape_bg(slide, Inches(0.5), Inches(1.5), Inches(5.8), Inches(4.5), RGBColor(70, 130, 200))
    add_text_box(slide, Inches(0.7), Inches(1.6), Inches(1), Inches(4),
                 "ANTES DE LAS ELECCIONES", font_size=14, bold=True, color=WHITE, alignment=PP_ALIGN.CENTER)
    tx = slide.shapes.add_textbox(Inches(1.8), Inches(1.8), Inches(4.2), Inches(4)).text_frame
    tx.word_wrap = True
    before = ["Caminatas", "Kioskos", "Promoción del voto consciente informado y cultura de paz"]
    for i, b in enumerate(before):
        if i==0:
            p=tx.paragraphs[0]
            p.text=f"• {b}"
        else:
            p=tx.add_paragraph()
            p.text=f"• {b}"
        p.font.size=Pt(15)
        p.font.color.rgb=WHITE
        p.font.name="Calibri"
        p.space_after=Pt(10)
    # Imagen antes
    img_before = os.path.join(ASSETS, "page10_img5_143.jpeg")
    if os.path.exists(img_before):
        slide.shapes.add_picture(img_before, Inches(0.8), Inches(1.2), Inches(1.5), Inches(1))

    # Día
    add_shape_bg(slide, Inches(7), Inches(1.5), Inches(5.8), Inches(4.5), RGBColor(70, 130, 200))
    add_text_box(slide, Inches(7.2), Inches(1.6), Inches(1), Inches(4),
                 "EL DÍA DE LAS ELECCIONES", font_size=14, bold=True, color=WHITE, alignment=PP_ALIGN.CENTER)
    tx2 = slide.shapes.add_textbox(Inches(8.5), Inches(1.8), Inches(4.2), Inches(4)).text_frame
    tx2.word_wrap=True
    during = [
        "Apoyar a los adultos mayores",
        "Personas con discapacidad",
        "Mujeres embarazadas",
        "Personas con niños en brazos",
        "Brindar acompañamiento y asistencia a la ciudadanía en general"
    ]
    for i, d in enumerate(during):
        if i==0:
            p=tx2.paragraphs[0]
            p.text=f"• {d}"
        else:
            p=tx2.add_paragraph()
            p.text=f"• {d}"
        p.font.size=Pt(13)
        p.font.color.rgb=WHITE
        p.font.name="Calibri"
        p.space_after=Pt(8)
    img_during = os.path.join(ASSETS, "page10_img6_144.jpeg")
    if os.path.exists(img_during):
        slide.shapes.add_picture(img_during, Inches(7.3), Inches(1.2), Inches(1.5), Inches(1))

    add_footer(slide)

    # === SLIDE 10: CÓMO SUMARTE ===
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, WHITE)
    add_text_box(slide, Inches(0.5), Inches(0.3), Inches(4), Inches(1.2),
                 "¿CÓMO PUEDES SUMARTE?", font_size=28, bold=True, color=BLUE_DARK, alignment=PP_ALIGN.LEFT)
    # Imagen
    img_sum = os.path.join(ASSETS, "page11_img2_157.jpeg")
    if os.path.exists(img_sum):
        slide.shapes.add_picture(img_sum, Inches(0.5), Inches(1.8), Inches(5), Inches(4))
    # Pasos
    pasos = [
        ("1", "Llena el formulario como interesado/a para formar parte del VCE"),
        ("2", "Cuando el curso esté habilitado, recibirás una notificación para que lo realices en línea"),
        ("3", "Al aprobarlo, estarás acreditado/a oficialmente como voluntario/a cívico electoral")
    ]
    y = 1.8
    for num, txt in pasos:
        # Círculo número
        shape = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(6.2), Inches(y), Inches(0.6), Inches(0.6))
        shape.fill.solid()
        shape.fill.fore_color.rgb = BLUE_CYAN
        shape.line.fill.background()
        add_text_box(slide, Inches(6.2), Inches(y), Inches(0.6), Inches(0.6), num, font_size=18, bold=True, color=BLUE_DARK, alignment=PP_ALIGN.CENTER)
        add_text_box(slide, Inches(7), Inches(y), Inches(5.5), Inches(0.8), txt, font_size=14, bold=False, color=BLACK, alignment=PP_ALIGN.LEFT)
        y+=1.2
    # QR
    qr_img = os.path.join(ASSETS, "page11_img6_163.png")
    if os.path.exists(qr_img):
        slide.shapes.add_picture(qr_img, Inches(10.5), Inches(4.5), Inches(2), Inches(2))
        add_text_box(slide, Inches(8), Inches(5), Inches(2.5), Inches(0.8), "Envía un mensaje a Voluntariado Cívico Electoral por WhatsApp", font_size=10, bold=True, color=BLACK, alignment=PP_ALIGN.RIGHT)
    add_footer(slide)

    # === SLIDE 11: Y DESPUÉS DEL CURSO ===
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, BLUE_DARK)
    add_shape_bg(slide, Inches(0), Inches(3), Inches(13.33), Inches(3.9), RGBColor(75, 192, 200))
    add_text_box(slide, Inches(0.5), Inches(0.3), Inches(12), Inches(1),
                 "¿Y DESPUÉS DEL CURSO?", font_size=32, bold=True, color=WHITE, alignment=PP_ALIGN.CENTER)
    # Imágenes circulares originales
    img_after1 = os.path.join(ASSETS, "page12_img5_176.jpeg")
    img_after2 = os.path.join(ASSETS, "page12_img7_65.jpeg")
    if os.path.exists(img_after1):
        slide.shapes.add_picture(img_after1, Inches(2.5), Inches(1.5), Inches(2.5), Inches(2.5))
    if os.path.exists(img_after2):
        slide.shapes.add_picture(img_after2, Inches(8.3), Inches(1.5), Inches(2.5), Inches(2.5))
    add_text_box(slide, Inches(1.5), Inches(4.5), Inches(4.5), Inches(1),
                 "Dejarás de ser espectador para convertirte en protagonista", font_size=16, bold=True, color=WHITE, alignment=PP_ALIGN.CENTER)
    add_text_box(slide, Inches(7.3), Inches(4.5), Inches(4.5), Inches(1),
                 "Podrás participar en Actividades, eventos y campañas de promoción", font_size=16, bold=True, color=WHITE, alignment=PP_ALIGN.CENTER)
    add_footer(slide)

    # === SLIDE 12: BENEFICIOS ===
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, BLUE_MED)
    add_text_box(slide, Inches(0.5), Inches(0.3), Inches(5), Inches(1.2),
                 "BENEFICIOS DE PERTENECER AL VCE", font_size=26, bold=True, color=WHITE, alignment=PP_ALIGN.LEFT)
    img_ben = os.path.join(ASSETS, "page13_img1_65.jpeg")
    if os.path.exists(img_ben):
        slide.shapes.add_picture(img_ben, Inches(0.5), Inches(1.8), Inches(5), Inches(4.5))
    beneficios = [
        ("Te formas y aprendes", "Recibes una certificación oficial del Tribunal Supremo Electoral"),
        ("Desarrollas habilidades", "Como hablar en público, trabajar en equipo, liderazgo e incidencia"),
        ("Eres parte de una familia", "Integras una red de jóvenes comprometidos a nivel nacional"),
        ("Participas en espacios democráticos", "Te involucras en actividades cívicas y electorales"),
        ("Enriqueces tu hoja de vida", "Obtienes un diploma y carta de recomendación institucional por tu servicio y experiencia como voluntario")
    ]
    y=0.5
    for titulo, desc in beneficios:
        add_text_box(slide, Inches(6.5), Inches(y), Inches(6), Inches(0.4), titulo, font_size=16, bold=True, color=WHITE, alignment=PP_ALIGN.LEFT)
        add_text_box(slide, Inches(6.5), Inches(y+0.35), Inches(6), Inches(0.6), desc, font_size=12, bold=False, color=RGBColor(200,230,255), alignment=PP_ALIGN.LEFT)
        y+=1.2
    add_footer(slide)

    # === SLIDE 13: FRASE INSPIRADORA ===
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, BLUE_DARK)
    add_text_box(slide, Inches(0.5), Inches(0.5), Inches(12), Inches(1.5),
                 "El VCE es ese espacio donde tu voz se escucha y tu participación ¡transforma la sociedad!", font_size=28, bold=True, color=WHITE, alignment=PP_ALIGN.CENTER)
    img_insp = os.path.join(ASSETS, "page14_img7_222.jpeg")
    if os.path.exists(img_insp):
        slide.shapes.add_picture(img_insp, Inches(3.5), Inches(2.2), Inches(6.3), Inches(4))
    add_footer(slide)
    add_logo_vce(slide)

    # === SLIDE 14: ANFITRIONES ===
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, BLUE_DARK)
    add_text_box(slide, Inches(0.5), Inches(0.2), Inches(12), Inches(0.6),
                 "ANFITRIONES DEL EVENTO ELECTORAL", font_size=22, bold=True, color=WHITE, alignment=PP_ALIGN.CENTER)
    # Usar las imágenes originales de anfitriones
    img_a1 = os.path.join(ASSETS, "page16_img1_233.jpeg")
    img_a2 = os.path.join(ASSETS, "page16_img2_234.jpeg")
    img_a3 = os.path.join(ASSETS, "page16_img3_235.jpeg")
    # Mapear a las extraídas de page15 también
    img_a1b = os.path.join(ASSETS, "page15_img1_227.jpeg")
    img_a2b = os.path.join(ASSETS, "page15_img2_228.jpeg")
    # Usar page16
    if os.path.exists(img_a1):
        slide.shapes.add_picture(img_a1, Inches(0.3), Inches(1), Inches(4), Inches(5.5))
    if os.path.exists(img_a2):
        slide.shapes.add_picture(img_a2, Inches(4.6), Inches(1.8), Inches(4), Inches(4.5))
    if os.path.exists(img_a3):
        slide.shapes.add_picture(img_a3, Inches(9), Inches(1), Inches(4), Inches(5.5))
    add_text_box(slide, Inches(0.3), Inches(6.2), Inches(4), Inches(0.5), "VOLUNTARIADO CÍVICO ELECTORAL", font_size=14, bold=True, color=WHITE, alignment=PP_ALIGN.CENTER)

    # === SLIDE 15: VOLUNTARIADO EN ACCIÓN ===
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, BLUE_DARK)
    # Imágenes de acción
    img_acc1 = os.path.join(ASSETS, "page15_img1_227.jpeg")
    img_acc2 = os.path.join(ASSETS, "page15_img2_228.jpeg")
    if os.path.exists(img_acc1):
        slide.shapes.add_picture(img_acc1, Inches(0.2), Inches(0.2), Inches(6.2), Inches(6.5))
    if os.path.exists(img_acc2):
        slide.shapes.add_picture(img_acc2, Inches(7), Inches(0.8), Inches(6), Inches(5.5))
    add_text_box(slide, Inches(0.5), Inches(6), Inches(5.5), Inches(0.6), "VOLUNTARIADO CÍVICO ELECTORAL", font_size=16, bold=True, color=WHITE, alignment=PP_ALIGN.CENTER)

    # === SLIDE 16: PRENSA LIBRE ===
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, WHITE)
    img_prensa = os.path.join(ASSETS, "page17_render.png")
    if os.path.exists(img_prensa):
        slide.shapes.add_picture(img_prensa, Inches(0.5), Inches(0.2), Inches(12.3), Inches(6.5))
    add_footer(slide)

    # === SLIDE 17: ÚNETE QR GRANDE ===
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, BLUE_DARK)
    add_text_box(slide, Inches(0.5), Inches(0.3), Inches(12), Inches(1),
                 "ÚNETE AL VOLUNTARIADO CÍVICO ELECTORAL", font_size=30, bold=True, color=WHITE, alignment=PP_ALIGN.CENTER)
    add_text_box(slide, Inches(0.5), Inches(1.2), Inches(12), Inches(0.6),
                 "¡INSCRÍBETE!", font_size=22, bold=True, color=RGBColor(200,230,255), alignment=PP_ALIGN.CENTER)
    # QR grande
    qr_big = os.path.join(ASSETS, "page19_img6_255.jpeg")
    # Buscar QR
    qr_candidates = [os.path.join(ASSETS, f) for f in os.listdir(ASSETS) if "163" in f or "255" in f]
    if qr_candidates:
        for q in qr_candidates:
            if os.path.exists(q):
                try:
                    slide.shapes.add_picture(q, Inches(5), Inches(2), Inches(3.3), Inches(3.3))
                    break
                except:
                    pass
    # Si no, usar render page19
    page19 = os.path.join(ASSETS, "page19_render.png")
    if os.path.exists(page19):
        slide.shapes.add_picture(page19, Inches(3), Inches(1.8), Inches(7.3), Inches(4.8))
    add_footer(slide)
    add_logo_vce(slide)

    # === SLIDE 18: REDES SOCIALES ===
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, RGBColor(10, 35, 75))
    page20 = os.path.join(ASSETS, "page20_render.png")
    if os.path.exists(page20):
        slide.shapes.add_picture(page20, Inches(0), Inches(0), Inches(13.33), Inches(7.5))
    else:
        # Recreate
        add_text_box(slide, Inches(0.5), Inches(0.5), Inches(6), Inches(1),
                     "Síguenos en nuestras redes sociales", font_size=28, bold=True, color=WHITE, alignment=PP_ALIGN.LEFT)
        redes = [
            "WhatsApp VCE 3036-4641",
            "@TSEGuatemala",
            "@TSE Guatemala",
            "@tse_guatemala",
            "@TSE_Guatemala"
        ]
        y=2
        for r in redes:
            add_text_box(slide, Inches(0.5), Inches(y), Inches(5), Inches(0.5), r, font_size=16, bold=False, color=WHITE)
            y+=0.7

    # === SLIDE 19: CIERRE LOGO VCE ===
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, WHITE)
    # Fondo punteado
    # Logo VCE grande
    logo_vce_big = os.path.join(ASSETS, "page3_img6_28.jpeg")
    # Intentar encontrar logo voluntariado cívico con manos
    candidates = [os.path.join(ASSETS, f) for f in os.listdir(ASSETS) if "227" in f or "228" in f or "28.jpeg" in f]
    # Usar el render de página 2 que es logo voluntariado
    page2 = os.path.join(ASSETS, "page2_render.png")
    if os.path.exists(page2):
        slide.shapes.add_picture(page2, Inches(2), Inches(0.5), Inches(9.3), Inches(6))
    else:
        if os.path.exists(logo_vce_big):
            slide.shapes.add_picture(logo_vce_big, Inches(4), Inches(1), Inches(5), Inches(5))
    add_text_box(slide, Inches(1), Inches(6.2), Inches(11), Inches(0.5),
                 "Tribunal Supremo Electoral - Guatemala, C.A.", font_size=14, bold=True, color=BLUE_MED, alignment=PP_ALIGN.CENTER)

    # === SLIDE 20: GRACIAS ===
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_background(slide, BLUE_DARK)
    add_text_box(slide, Inches(1), Inches(1.5), Inches(11), Inches(1),
                 "¡GRACIAS!", font_size=44, bold=True, color=WHITE, alignment=PP_ALIGN.CENTER)
    add_text_box(slide, Inches(1), Inches(2.8), Inches(11), Inches(1),
                 "Tu voz y tu participación transforman Guatemala", font_size=20, bold=False, color=RGBColor(200,230,255), alignment=PP_ALIGN.CENTER)
    # Logos finales
    if os.path.exists(logo_tse):
        slide.shapes.add_picture(logo_tse, Inches(5.5), Inches(4), Inches(2.3), Inches(1.3))
    add_text_box(slide, Inches(1), Inches(5.5), Inches(11), Inches(0.5),
                 "Voluntariado Cívico Electoral | Tribunal Supremo Electoral", font_size=12, bold=True, color=WHITE, alignment=PP_ALIGN.CENTER)

    prs.save(OUTPUT_FORMAL)
    print(f"Presentación formal guardada: {OUTPUT_FORMAL}")

def create_faithful_presentation():
    """Crea una presentación que usa exactamente cada página renderizada del PDF como slide, garantizando mismas imágenes"""
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    for i in range(1, 21):
        render_path = os.path.join(ASSETS, f"page{i}_render.png")
        if not os.path.exists(render_path):
            continue
        slide = prs.slides.add_slide(prs.slide_layouts[6])
        # Fondo blanco
        add_background(slide, WHITE)
        # Imagen cubre todo el slide
        slide.shapes.add_picture(render_path, Inches(0), Inches(0), Inches(13.333), Inches(7.5))
    prs.save(OUTPUT_FIEL)
    print(f"Presentación fiel guardada: {OUTPUT_FIEL}")

if __name__ == "__main__":
    create_formal_presentation()
    create_faithful_presentation()
