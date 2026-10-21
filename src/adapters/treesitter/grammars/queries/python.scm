; Definitions. Earlier patterns win, so a function in a class is a method.

(class_definition
  body: (block (function_definition name: (identifier) @name) @definition.method))
(class_definition
  body: (block (decorated_definition definition: (function_definition name: (identifier) @name) @definition.method)))
(function_definition name: (identifier) @name) @definition.function
(class_definition name: (identifier) @name) @definition.class
(module (expression_statement (assignment left: (identifier) @name) @definition.variable))

; References

(call function: (identifier) @reference)
(attribute object: (identifier) @reference)
(attribute attribute: (identifier) @reference)
(type (identifier) @reference)
(type (generic_type (identifier) @reference))
