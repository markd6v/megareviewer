; Definitions. Earlier patterns win, so a function assigned to a variable is a function.

(function_declaration name: (identifier) @name) @definition.function
(generator_function_declaration name: (identifier) @name) @definition.function
(function_signature name: (identifier) @name) @definition.function
(variable_declarator
  name: (identifier) @name
  value: [(arrow_function) (function_expression) (generator_function)]) @definition.function
(method_definition name: (property_identifier) @name) @definition.method
(class_declaration name: (type_identifier) @name) @definition.class
(abstract_class_declaration name: (type_identifier) @name) @definition.class
(interface_declaration name: (type_identifier) @name) @definition.type
(type_alias_declaration name: (type_identifier) @name) @definition.type
(enum_declaration name: (identifier) @name) @definition.type
(program (lexical_declaration (variable_declarator name: (identifier) @name) @definition.variable))
(program (variable_declaration (variable_declarator name: (identifier) @name) @definition.variable))
(export_statement
  declaration: (lexical_declaration (variable_declarator name: (identifier) @name) @definition.variable))
(export_statement
  declaration: (variable_declaration (variable_declarator name: (identifier) @name) @definition.variable))

; References

(call_expression function: (identifier) @reference)
(new_expression constructor: (identifier) @reference)
(extends_clause value: (identifier) @reference)
(member_expression object: (identifier) @reference)
(member_expression property: (property_identifier) @reference)
(type_identifier) @reference
