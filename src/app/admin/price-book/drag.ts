/**
 * The data type a dragged catalogue row carries.
 *
 * A custom MIME type, not 'text/plain': a drop target has to be able to tell
 * a row of this table from a word dragged out of a text field or a file
 * dropped in from the desktop, and the type is the only thing readable
 * during dragover, when the payload itself is deliberately not.
 */
export const DRAG_MIME = 'application/x-piscinas-price-book-item'
