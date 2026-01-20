-- Feature Request & Roadmap System
-- Complete database schema for internal feature request management

-- ===========================================
-- ENUMS
-- ===========================================

CREATE TYPE feature_request_status AS ENUM (
    'submitted',
    'reviewing', 
    'planned',
    'in_progress',
    'completed',
    'rejected',
    'duplicate'
);

CREATE TYPE feature_request_category AS ENUM (
    'dashboard',
    'clients',
    'leads',
    'payments',
    'reports',
    'integrations',
    'general'
);

CREATE TYPE feature_request_type AS ENUM (
    'bug',
    'feature',
    'improvement',
    'integration'
);

CREATE TYPE feature_request_priority AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);

CREATE TYPE effort_estimate AS ENUM (
    'xs',
    's',
    'm',
    'l',
    'xl'
);

-- ===========================================
-- TABLES
-- ===========================================

-- Feature Tags (admin-created labels)
CREATE TABLE feature_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6b7280', -- hex color
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Milestones (release groupings)
CREATE TABLE milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    target_date DATE,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Core Feature Requests table
CREATE TABLE feature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category feature_request_category NOT NULL DEFAULT 'general',
    type feature_request_type NOT NULL DEFAULT 'feature',
    priority feature_request_priority NOT NULL DEFAULT 'medium',
    status feature_request_status NOT NULL DEFAULT 'submitted',
    
    -- Relationships
    submitter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
    
    -- Denormalized counts for performance
    vote_count INTEGER NOT NULL DEFAULT 0,
    watcher_count INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    
    -- Planning fields
    target_quarter TEXT, -- e.g., 'Q1 2026'
    effort_estimate effort_estimate,
    priority_score INTEGER NOT NULL DEFAULT 0, -- computed score
    
    -- Metadata
    tags TEXT[] NOT NULL DEFAULT '{}',
    related_request_ids UUID[] NOT NULL DEFAULT '{}',
    external_links JSONB NOT NULL DEFAULT '[]', -- [{title, url}]
    screenshot_urls TEXT[] NOT NULL DEFAULT '{}',
    
    -- Admin fields
    admin_notes TEXT,
    rejection_reason TEXT,
    release_notes TEXT,
    
    -- State
    is_archived BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Votes (one per user per request)
CREATE TABLE feature_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(request_id, user_id)
);

-- Comments
CREATE TABLE feature_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_admin_response BOOLEAN NOT NULL DEFAULT false,
    reactions JSONB NOT NULL DEFAULT '{}', -- {"👍": ["user_id1", "user_id2"]}
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Watchers (subscribe to updates)
CREATE TABLE feature_watchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(request_id, user_id)
);

-- Status History (audit trail)
CREATE TABLE feature_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
    old_status feature_request_status,
    new_status feature_request_status NOT NULL,
    changed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Announcements (pinned messages)
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);

-- Notifications
CREATE TABLE feature_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id UUID REFERENCES feature_requests(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'status_change', 'new_comment', 'mention', 'completed'
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- INDEXES
-- ===========================================

CREATE INDEX idx_feature_requests_status ON feature_requests(status);
CREATE INDEX idx_feature_requests_category ON feature_requests(category);
CREATE INDEX idx_feature_requests_submitter ON feature_requests(submitter_id);
CREATE INDEX idx_feature_requests_milestone ON feature_requests(milestone_id);
CREATE INDEX idx_feature_requests_created ON feature_requests(created_at DESC);
CREATE INDEX idx_feature_requests_votes ON feature_requests(vote_count DESC);
CREATE INDEX idx_feature_requests_priority_score ON feature_requests(priority_score DESC);
CREATE INDEX idx_feature_requests_archived ON feature_requests(is_archived) WHERE is_archived = false;

CREATE INDEX idx_feature_votes_request ON feature_votes(request_id);
CREATE INDEX idx_feature_votes_user ON feature_votes(user_id);

CREATE INDEX idx_feature_comments_request ON feature_comments(request_id);
CREATE INDEX idx_feature_comments_created ON feature_comments(created_at);

CREATE INDEX idx_feature_watchers_request ON feature_watchers(request_id);
CREATE INDEX idx_feature_watchers_user ON feature_watchers(user_id);

CREATE INDEX idx_feature_notifications_user ON feature_notifications(user_id);
CREATE INDEX idx_feature_notifications_unread ON feature_notifications(user_id, is_read) WHERE is_read = false;

CREATE INDEX idx_announcements_active ON announcements(is_active) WHERE is_active = true;

-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Function to update vote count
CREATE OR REPLACE FUNCTION update_request_vote_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE feature_requests 
        SET vote_count = vote_count + 1,
            updated_at = now()
        WHERE id = NEW.request_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE feature_requests 
        SET vote_count = GREATEST(vote_count - 1, 0),
            updated_at = now()
        WHERE id = OLD.request_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to update watcher count
CREATE OR REPLACE FUNCTION update_request_watcher_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE feature_requests 
        SET watcher_count = watcher_count + 1
        WHERE id = NEW.request_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE feature_requests 
        SET watcher_count = GREATEST(watcher_count - 1, 0)
        WHERE id = OLD.request_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to update comment count
CREATE OR REPLACE FUNCTION update_request_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE feature_requests 
        SET comment_count = comment_count + 1,
            updated_at = now()
        WHERE id = NEW.request_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE feature_requests 
        SET comment_count = GREATEST(comment_count - 1, 0),
            updated_at = now()
        WHERE id = OLD.request_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate priority score
CREATE OR REPLACE FUNCTION calculate_priority_score()
RETURNS TRIGGER AS $$
DECLARE
    age_days INTEGER;
    priority_bonus INTEGER;
BEGIN
    -- Calculate age in days
    age_days := EXTRACT(DAY FROM (now() - NEW.created_at));
    
    -- Priority bonus
    priority_bonus := CASE NEW.priority
        WHEN 'critical' THEN 100
        WHEN 'high' THEN 50
        WHEN 'medium' THEN 20
        WHEN 'low' THEN 0
    END;
    
    -- Score = (votes * 3) + (age / 2) + priority_bonus
    NEW.priority_score := (NEW.vote_count * 3) + (age_days / 2) + priority_bonus;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to track status changes
CREATE OR REPLACE FUNCTION track_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO feature_status_history (request_id, old_status, new_status, changed_by)
        VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
        
        -- Set completed_at if moving to completed
        IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
            NEW.completed_at := now();
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- TRIGGERS
-- ===========================================

CREATE TRIGGER trigger_vote_count
    AFTER INSERT OR DELETE ON feature_votes
    FOR EACH ROW EXECUTE FUNCTION update_request_vote_count();

CREATE TRIGGER trigger_watcher_count
    AFTER INSERT OR DELETE ON feature_watchers
    FOR EACH ROW EXECUTE FUNCTION update_request_watcher_count();

CREATE TRIGGER trigger_comment_count
    AFTER INSERT OR DELETE ON feature_comments
    FOR EACH ROW EXECUTE FUNCTION update_request_comment_count();

CREATE TRIGGER trigger_priority_score
    BEFORE INSERT OR UPDATE ON feature_requests
    FOR EACH ROW EXECUTE FUNCTION calculate_priority_score();

CREATE TRIGGER trigger_status_history
    BEFORE UPDATE ON feature_requests
    FOR EACH ROW EXECUTE FUNCTION track_status_change();

CREATE TRIGGER trigger_requests_updated_at
    BEFORE UPDATE ON feature_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_comments_updated_at
    BEFORE UPDATE ON feature_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_milestones_updated_at
    BEFORE UPDATE ON milestones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_notifications ENABLE ROW LEVEL SECURITY;

-- Feature Requests Policies
CREATE POLICY "Anyone can view non-archived requests"
    ON feature_requests FOR SELECT
    USING (is_archived = false OR submitter_id = auth.uid());

CREATE POLICY "Authenticated users can create requests"
    ON feature_requests FOR INSERT
    WITH CHECK (auth.uid() = submitter_id);

CREATE POLICY "Super admins can update any request"
    ON feature_requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "Users can update own request title/description only"
    ON feature_requests FOR UPDATE
    USING (submitter_id = auth.uid())
    WITH CHECK (status = 'submitted'); -- Can only edit if not yet reviewed

-- Votes Policies
CREATE POLICY "Anyone can view votes"
    ON feature_votes FOR SELECT
    USING (true);

CREATE POLICY "Users can vote"
    ON feature_votes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own vote"
    ON feature_votes FOR DELETE
    USING (auth.uid() = user_id);

-- Comments Policies
CREATE POLICY "Anyone can view comments"
    ON feature_comments FOR SELECT
    USING (true);

CREATE POLICY "Users can create comments"
    ON feature_comments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
    ON feature_comments FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
    ON feature_comments FOR DELETE
    USING (auth.uid() = user_id);

-- Watchers Policies
CREATE POLICY "Users can see own watches"
    ON feature_watchers FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can watch requests"
    ON feature_watchers FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unwatch requests"
    ON feature_watchers FOR DELETE
    USING (auth.uid() = user_id);

-- Status History Policies
CREATE POLICY "Anyone can view status history"
    ON feature_status_history FOR SELECT
    USING (true);

-- Tags Policies
CREATE POLICY "Anyone can view tags"
    ON feature_tags FOR SELECT
    USING (true);

CREATE POLICY "Super admins can manage tags"
    ON feature_tags FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Milestones Policies
CREATE POLICY "Anyone can view milestones"
    ON milestones FOR SELECT
    USING (true);

CREATE POLICY "Super admins can manage milestones"
    ON milestones FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Announcements Policies
CREATE POLICY "Anyone can view active announcements"
    ON announcements FOR SELECT
    USING (is_active = true OR created_by = auth.uid());

CREATE POLICY "Super admins can manage announcements"
    ON announcements FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- Notifications Policies
CREATE POLICY "Users can view own notifications"
    ON feature_notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
    ON feature_notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- System can insert notifications (using service role)
CREATE POLICY "System can create notifications"
    ON feature_notifications FOR INSERT
    WITH CHECK (true);
