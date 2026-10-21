; Definitions

(method_declaration name: (identifier) @name) @definition.method
(constructor_declaration name: (identifier) @name) @definition.method
(class_declaration name: (identifier) @name) @definition.class
(record_declaration name: (identifier) @name) @definition.class
(enum_declaration name: (identifier) @name) @definition.type
(interface_declaration name: (identifier) @name) @definition.type
(annotation_type_declaration name: (identifier) @name) @definition.type
(field_declaration declarator: (variable_declarator name: (identifier) @name)) @definition.variable

; References

(method_invocation name: (identifier) @reference)
(method_invocation object: (identifier) @reference)
(field_access object: (identifier) @reference)
(field_access field: (identifier) @reference)
(type_identifier) @reference
