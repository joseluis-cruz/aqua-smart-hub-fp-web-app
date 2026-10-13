"""Genera el manual breve de la interfaz en formato DOCX sin dependencias externas."""

from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "manual.docx"
WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def run(text, *, bold=False, color=None, size=None):
    properties = []
    if bold:
        properties.append("<w:b/>")
    if color:
        properties.append(f'<w:color w:val="{color}"/>')
    if size:
        properties.append(f'<w:sz w:val="{size}"/>')
    formatting = f"<w:rPr>{''.join(properties)}</w:rPr>" if properties else ""
    return f'<w:r>{formatting}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>'


def paragraph(text="", *, style=None, before=0, after=160, align=None):
    properties = []
    if style:
        properties.append(f'<w:pStyle w:val="{style}"/>')
    if before or after:
        properties.append(f'<w:spacing w:before="{before}" w:after="{after}"/>')
    if align:
        properties.append(f'<w:jc w:val="{align}"/>')
    ppr = f"<w:pPr>{''.join(properties)}</w:pPr>" if properties else ""
    return f"<w:p>{ppr}{run(text)}</w:p>"


def screenshot_placeholder(label, number):
    return paragraph(f"[Pegar aquí la captura {number}: {label}]", style="Placeholder", before=80, after=80)


sections = [
    (
        "Vista general",
        "Es la pantalla de entrada. En la parte superior aparecen la fecha y la hora de la última captura recibida. "
        "El resumen reúne el número de tanques monitorizados, las alertas activas y los valores medios de temperatura "
        "y saturación de oxígeno. Desde el menú lateral se accede a los demás apartados.",
        "Vista general y resumen de la instalación",
    ),
    (
        "Tanques",
        "Se muestran los cuatro tanques en una fila. Cada tarjeta indica su estado y las lecturas actuales de temperatura, "
        "pH y saturación de oxígeno. Para consultar un tanque, se pulsa su tarjeta; la selección queda resaltada y las "
        "gráficas del historial se actualizan con sus datos.",
        "Tarjetas de los cuatro tanques",
    ),
    (
        "Historial",
        "Presenta, en paralelo, las curvas de temperatura, pH y saturación de oxígeno del tanque seleccionado. Los botones "
        "Día, Semana, Mes y Año cambian el periodo visible. Cada gráfica muestra el valor actual, su estado y los límites "
        "informativos y críticos; el extremo derecho corresponde a la captura más reciente.",
        "Gráficas históricas de un tanque",
    ),
    (
        "Alertas",
        "La sección «Alertas activas» reúne las variables que han sobrepasado un umbral. Cada aviso identifica el tanque, "
        "la variable, el valor registrado y el límite correspondiente. Los avisos críticos se presentan antes que los "
        "informativos para facilitar su revisión.",
        "Listado de alertas activas",
    ),
    (
        "Notificaciones",
        "El historial de notificaciones permite consultar los avisos por correo asociados a las alertas. Cada entrada "
        "indica el nivel del aviso, el tanque, la variable, el valor que alcanzó el umbral y la fecha y hora del registro. "
        "La lista aparece ordenada desde la notificación más reciente.",
        "Historial de notificaciones",
    ),
    (
        "Configuración",
        "Esta opción abre una página independiente. En «Umbrales de control» se ajustan los mínimos y máximos informativos "
        "y críticos de temperatura y pH. Para la saturación de oxígeno solo se establecen mínimos. Más abajo se elige "
        "la frecuencia de muestreo y se escriben los correos destinatarios, uno por línea o separados por comas. "
        "El botón «Guardar configuración» aplica los cambios al volver al panel.",
        "Formulario de configuración",
    ),
]


parts = [
    paragraph("AquaSmart Hub FP", style="Title", after=90),
    paragraph("Manual breve de la interfaz web", style="Subtitle", after=330),
    paragraph(
        "Este documento explica cómo consultar las lecturas y alertas, revisar el historial y ajustar la configuración "
        "desde el menú lateral. Las cinco primeras opciones conducen a secciones del panel; Configuración abre su propia página.",
        after=280,
    ),
]

for number, (name, description, caption) in enumerate(sections, start=1):
    parts.append(paragraph(f"{number}. {name}", style="Heading1", before=90 if number == 1 else 300,
                           after=160))
    parts.append(paragraph(description, after=130))
    parts.append(screenshot_placeholder(name, number))
    parts.append(paragraph(f"Figura {number}. {caption}.", style="Caption", before=0, after=0))

body = "".join(parts)
document = (
    f'<w:document xmlns:w="{WORD_NS}"><w:body>{body}'
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
    '<w:pgMar w:top="1134" w:right="1190" w:bottom="1134" w:left="1190" '
    'w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>'
    '</w:body></w:document>'
)

styles = f'''<w:styles xmlns:w="{WORD_NS}">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/>
    <w:sz w:val="22"/><w:color w:val="20344E"/></w:rPr>
    <w:pPr><w:spacing w:line="310" w:lineRule="auto"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="48"/>
    <w:color w:val="0B2448"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/>
    <w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="26"/>
    <w:color w:val="137E9B"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/><w:pPr><w:keepNext/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="0B4C70"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/>
    <w:basedOn w:val="Normal"/><w:rPr><w:i/><w:sz w:val="18"/>
    <w:color w:val="557389"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Placeholder"><w:name w:val="Placeholder"/>
    <w:basedOn w:val="Normal"/><w:rPr><w:i/><w:sz w:val="20"/>
    <w:color w:val="137E9B"/></w:rPr></w:style>
</w:styles>'''

content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>'''
relationships = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>'''
document_relationships = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>'''
core = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Manual breve de la interfaz web · AquaSmart Hub FP</dc:title>
 <dc:subject>Monitorización y notificación de incidencias</dc:subject></cp:coreProperties>'''

with ZipFile(OUTPUT, "w", ZIP_DEFLATED) as archive:
    archive.writestr("[Content_Types].xml", content_types)
    archive.writestr("_rels/.rels", relationships)
    archive.writestr("docProps/core.xml", core)
    archive.writestr("word/document.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + document)
    archive.writestr("word/styles.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + styles)
    archive.writestr("word/_rels/document.xml.rels", document_relationships)

print(OUTPUT)
