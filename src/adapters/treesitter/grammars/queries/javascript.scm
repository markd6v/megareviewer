; Definitions. Earlier patterns win, so a function assigned to a variable is a function.

(function_declaration name: (identifier) @name) @definition.function
(generator_function_declaration name: (identifier) @name) @definition.function
(variable_declarator
  name: (identifier) @name
  value: [(arrow_function) (function_expression) (generator_function)]) @definition.function
(method_definition name: (property_identifier) @name) @definition.method
(class_declaration name: (identifier) @name) @definition.class
(program (lexical_declaration (variable_declarator name: (identifier) @name) @definition.variable))
(program (variable_declaration (variable_declarator name: (identifier) @name) @definition.variable))
(export_statement
  declaration: (lexical_declaration (variable_declarator name: (identifier) @name) @definition.variable))
(export_statement
  declaration: (variable_declaration (variable_declarator name: (identifier) @name) @definition.variable))

; References

(call_expression function: (identifier) @reference)
(new_expression constructor: (identifier) @reference)
(class_heritage (identifier) @reference)
(member_expression object: (identifier) @reference)
(member_expression property: (property_identifier) @reference)
