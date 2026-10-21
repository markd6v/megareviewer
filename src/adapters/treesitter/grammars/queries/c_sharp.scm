; Definitions

(local_function_statement name: (identifier) @name) @definition.function
(method_declaration name: (identifier) @name) @definition.method
(constructor_declaration name: (identifier) @name) @definition.method
(property_declaration name: (identifier) @name) @definition.method
(class_declaration name: (identifier) @name) @definition.class
(record_declaration name: (identifier) @name) @definition.class
(struct_declaration name: (identifier) @name) @definition.class
(interface_declaration name: (identifier) @name) @definition.type
(enum_declaration name: (identifier) @name) @definition.type
(delegate_declaration name: (identifier) @name) @definition.type
(field_declaration (variable_declaration (variable_declarator name: (identifier) @name))) @definition.variable

; References. C# has no separate node for type names, so types are matched by position.

(invocation_expression function: (identifier) @reference)
(object_creation_expression type: (identifier) @reference)
(member_access_expression expression: (identifier) @reference)
(member_access_expression name: (identifier) @reference)
(variable_declaration type: (identifier) @reference)
(parameter type: (identifier) @reference)
(method_declaration returns: (identifier) @reference)
(base_list (identifier) @reference)
(generic_name (identifier) @reference)
(type_argument_list (identifier) @reference)
