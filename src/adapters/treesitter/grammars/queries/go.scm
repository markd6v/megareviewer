; Definitions. Package-level variables and constants are visible to the whole package.

(function_declaration name: (identifier) @name) @definition.function
(method_declaration name: (field_identifier) @name) @definition.method
(type_declaration (type_spec name: (type_identifier) @name type: (struct_type)) @definition.class)
(type_declaration (type_spec name: (type_identifier) @name) @definition.type)
(type_declaration (type_alias name: (type_identifier) @name) @definition.type)
(source_file (var_declaration (var_spec name: (identifier) @name) @definition.variable))
(source_file (const_declaration (const_spec name: (identifier) @name) @definition.variable))

; References

(call_expression function: (identifier) @reference)
(selector_expression operand: (identifier) @reference)
(selector_expression field: (field_identifier) @reference)
(type_identifier) @reference
