/**
 * Shared utility methods, classes, and types for the whole site
 */

export type Distinct<T, DistinctName> = T & { __TYPE__: DistinctName };
