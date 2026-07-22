import { supabase } from './supabase';

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  created_at: string;
  updated_at: string;
}

export const projectService = {
  /**
   * Create a new project
   */
  async createProject(
    userId: string, 
    title: string, 
    description?: string, 
    icon?: string, 
    color?: string,
    organizationId?: string | null
  ): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        title,
        description: description || null,
        icon: icon || 'Folder',
        color: color || 'zinc',
        organization_id: organizationId || null,
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      console.error('[ProjectService] Error creating project:', error);
      throw error;
    }

    return data as Project;
  },

  /**
   * Rename or update a project's details
   */
  async renameProject(projectId: string, newTitle: string, newDescription?: string): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .update({
        title: newTitle,
        ...(newDescription !== undefined ? { description: newDescription } : {}),
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .select('*')
      .single();

    if (error) {
      console.error('[ProjectService] Error renaming project:', error);
      throw error;
    }

    return data as Project;
  },

  /**
   * Fully update a project (title, description, color, icon)
   */
  async updateProject(
    projectId: string, 
    updates: { title?: string; description?: string; color?: string; icon?: string }
  ): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .select('*')
      .single();

    if (error) {
      console.error('[ProjectService] Error updating project:', error);
      throw error;
    }

    return data as Project;
  },

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      console.error('[ProjectService] Error deleting project:', error);
      throw error;
    }
  },

  /**
   * List all projects for a user
   */
  async listProjects(userId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[ProjectService] Error listing projects:', error);
      throw error;
    }

    return (data || []) as Project[];
  },

  /**
   * Get a single project
   */
  async getProject(projectId: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();

    if (error) {
      console.error('[ProjectService] Error getting project:', error);
      throw error;
    }

    return data as Project | null;
  },

  /**
   * Move a conversation into a project
   */
  async moveConversationIntoProject(conversationId: string, projectId: string): Promise<void> {
    const { error } = await supabase
      .from('conversations')
      .update({
        project_id: projectId,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    if (error) {
      console.error('[ProjectService] Error moving conversation to project:', error);
      throw error;
    }
  },

  /**
   * Remove a conversation from a project (move to personal workspace/uncategorized)
   */
  async removeConversationFromProject(conversationId: string): Promise<void> {
    const { error } = await supabase
      .from('conversations')
      .update({
        project_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    if (error) {
      console.error('[ProjectService] Error removing conversation from project:', error);
      throw error;
    }
  },

  /**
   * Count conversations inside a project
   */
  async countConversationsInsideProject(projectId: string): Promise<number> {
    const { count, error } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (error) {
      console.error('[ProjectService] Error counting conversations in project:', error);
      throw error;
    }

    return count || 0;
  }
};
