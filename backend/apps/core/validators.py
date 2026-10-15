from django.core.validators import RegexValidator

# Business codes such as "RH", "DEV-01", "CHEF_PROJET".
code_validator = RegexValidator(
    regex=r"^[A-Z0-9][A-Z0-9_-]*$",
    message="Le code ne peut contenir que des lettres majuscules, des chiffres, des tirets et des underscores.",
)