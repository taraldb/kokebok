/**
 * @typedef {Object} Ingredient
 * @property {string} id
 * @property {string} recipe_id
 * @property {number} position
 * @property {string} name
 * @property {number|null} amount
 * @property {string|null} unit
 * @property {string|null} description
 */

/**
 * @typedef {Object} Step
 * @property {string} id
 * @property {string} recipe_id
 * @property {number} position
 * @property {string} title
 * @property {number} timer_seconds
 * @property {Object} content_doc  ProseMirror JSON document
 */

/**
 * @typedef {Object} Recipe
 * @property {string} id
 * @property {string} title
 * @property {string|null} label
 * @property {string|null} description
 * @property {string|null} category
 * @property {string[]} tags
 * @property {Array} meta
 * @property {number|null} active_time
 * @property {number|null} servings_base
 * @property {string|null} servings_unit
 * @property {number} servings_step
 * @property {number} servings_min
 * @property {string[]} tips
 * @property {number} created_at
 * @property {number} updated_at
 * @property {Ingredient[]} ingredients
 * @property {Step[]} steps
 */
