/**
 * Parsed name result
 */
export interface ParsedName {
    firstName: string
    lastName: string
}

/**
 * Parse a full name into first and last name components.
 * Handles edge cases: single names, multiple names, empty/null input.
 *
 * @param fullName - The full name string to parse
 * @returns Object with firstName and lastName
 *
 * @example
 * parseName('John Doe') // { firstName: 'John', lastName: 'Doe' }
 * parseName('John') // { firstName: 'John', lastName: '' }
 * parseName('John Michael Doe') // { firstName: 'John', lastName: 'Michael Doe' }
 * parseName(null) // { firstName: 'Unknown', lastName: '' }
 * parseName('') // { firstName: 'Unknown', lastName: '' }
 */
export function parseName(fullName: string | null | undefined): ParsedName {
    // Handle null, undefined, or non-string input
    if (!fullName || typeof fullName !== 'string') {
        return { firstName: 'Unknown', lastName: '' }
    }

    const trimmed = fullName.trim()

    // Handle empty string after trim
    if (!trimmed) {
        return { firstName: 'Unknown', lastName: '' }
    }

    // Split by whitespace, filter out empty strings from multiple spaces
    const parts = trimmed.split(/\s+/).filter(Boolean)

    if (parts.length === 0) {
        return { firstName: 'Unknown', lastName: '' }
    }

    if (parts.length === 1) {
        // Single name - use as first name, empty last name
        return { firstName: parts[0], lastName: '' }
    }

    // Multiple parts: first part is first name, rest is last name
    const firstName = parts[0]
    const lastName = parts.slice(1).join(' ')

    return { firstName, lastName }
}
