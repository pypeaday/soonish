from pathlib import Path
from jinja2 import Environment, FileSystemLoader

# Template directory
TEMPLATE_DIR = Path(__file__).parent

# Create Jinja2 environment
env = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    autoescape=True,
    trim_blocks=True,
    lstrip_blocks=True
)


def render_template(template_name: str, **context) -> str:
    """Render a Jinja2 template with the given context"""
    template = env.get_template(template_name)
    return template.render(**context)
