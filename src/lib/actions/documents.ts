'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { ClientDocument, DocumentType } from '@/types/client'

// Get all documents for a client
export async function getClientDocuments(clientId: string): Promise<ClientDocument[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('client_documents')
        .select(`
            *,
            uploader:users!client_documents_uploaded_by_fkey(name, email)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching client documents:', error)
        return []
    }

    return data as ClientDocument[]
}

// Get documents by type for a client
export async function getClientDocumentsByType(clientId: string, documentType: DocumentType): Promise<ClientDocument[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('client_documents')
        .select(`
            *,
            uploader:users!client_documents_uploaded_by_fkey(name, email)
        `)
        .eq('client_id', clientId)
        .eq('document_type', documentType)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching client documents by type:', error)
        return []
    }

    return data as ClientDocument[]
}

// Upload a document
export async function uploadDocument(
    clientId: string,
    file: File,
    documentType: DocumentType,
    description?: string
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${clientId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('client-documents')
        .upload(fileName, file)

    if (uploadError) {
        console.error('Error uploading file:', uploadError)
        return { error: uploadError.message }
    }

    // Create database record
    const { data: doc, error: dbError } = await supabase
        .from('client_documents')
        .insert({
            client_id: clientId,
            name: file.name,
            description,
            document_type: documentType,
            storage_path: uploadData.path,
            file_size: file.size,
            mime_type: file.type,
            uploaded_by: user.id
        })
        .select()
        .single()

    if (dbError) {
        // Try to clean up the uploaded file
        await supabase.storage.from('client-documents').remove([fileName])
        console.error('Error creating document record:', dbError)
        return { error: dbError.message }
    }

    revalidatePath(`/clients/${clientId}`)
    return { success: true, document: doc }
}

// Create document record (when file is already uploaded)
export async function createDocumentRecord(
    clientId: string,
    data: {
        name: string
        description?: string
        document_type: DocumentType
        storage_path: string
        file_size?: number
        mime_type?: string
    }
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: doc, error } = await supabase
        .from('client_documents')
        .insert({
            client_id: clientId,
            name: data.name,
            description: data.description,
            document_type: data.document_type,
            storage_path: data.storage_path,
            file_size: data.file_size,
            mime_type: data.mime_type,
            uploaded_by: user?.id
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating document record:', error)
        return { error: error.message }
    }

    revalidatePath(`/clients/${clientId}`)
    return { success: true, document: doc }
}

// Update document metadata
export async function updateDocument(
    documentId: string,
    updates: Partial<{
        name: string
        description: string
        document_type: DocumentType
        is_shared_with_client: boolean
    }>
) {
    const supabase = await createClient()

    const { data: doc, error } = await supabase
        .from('client_documents')
        .update(updates)
        .eq('id', documentId)
        .select('client_id')
        .single()

    if (error) {
        console.error('Error updating document:', error)
        return { error: error.message }
    }

    revalidatePath(`/clients/${doc.client_id}`)
    return { success: true }
}

// Delete a document
export async function deleteDocument(documentId: string) {
    const supabase = await createClient()

    // Get the document first to get the storage path
    const { data: doc, error: fetchError } = await supabase
        .from('client_documents')
        .select('storage_path, client_id')
        .eq('id', documentId)
        .single()

    if (fetchError) {
        console.error('Error fetching document:', fetchError)
        return { error: fetchError.message }
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
        .from('client-documents')
        .remove([doc.storage_path])

    if (storageError) {
        console.error('Error deleting file from storage:', storageError)
        // Continue to delete the record anyway
    }

    // Delete database record
    const { error: dbError } = await supabase
        .from('client_documents')
        .delete()
        .eq('id', documentId)

    if (dbError) {
        console.error('Error deleting document record:', dbError)
        return { error: dbError.message }
    }

    revalidatePath(`/clients/${doc.client_id}`)
    return { success: true }
}

// Get signed URL for downloading a document
export async function getDocumentDownloadUrl(documentId: string) {
    const supabase = await createClient()

    // Get the storage path
    const { data: doc, error: fetchError } = await supabase
        .from('client_documents')
        .select('storage_path, name')
        .eq('id', documentId)
        .single()

    if (fetchError) {
        console.error('Error fetching document:', fetchError)
        return { error: fetchError.message }
    }

    // Create signed URL (valid for 1 hour)
    const { data, error } = await supabase.storage
        .from('client-documents')
        .createSignedUrl(doc.storage_path, 3600)

    if (error) {
        console.error('Error creating signed URL:', error)
        return { error: error.message }
    }

    return { success: true, url: data.signedUrl, fileName: doc.name }
}

// Toggle share with client status
export async function toggleShareWithClient(documentId: string) {
    const supabase = await createClient()

    // Get current status
    const { data: doc, error: fetchError } = await supabase
        .from('client_documents')
        .select('is_shared_with_client, client_id')
        .eq('id', documentId)
        .single()

    if (fetchError) {
        console.error('Error fetching document:', fetchError)
        return { error: fetchError.message }
    }

    // Toggle
    const { error } = await supabase
        .from('client_documents')
        .update({ is_shared_with_client: !doc.is_shared_with_client })
        .eq('id', documentId)

    if (error) {
        console.error('Error toggling share status:', error)
        return { error: error.message }
    }

    revalidatePath(`/clients/${doc.client_id}`)
    return { success: true, isShared: !doc.is_shared_with_client }
}
