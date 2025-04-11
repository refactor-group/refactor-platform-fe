# Refactor Platform Frontend Docker Image Management

## Managing the Project with Docker & GitHub Actions (CI/CD)

This project builds and pushes a multi-arch Docker image to [GHCR](https://github.com/orgs/refactor-group/packages) and triggers a build workflow on GitHub automatically on pushes to branches with open pull requests.

**Key Steps:**

1. **Develop Your Changes:**
   - Work on your feature or fix in your branch.
2. **Open a Pull Request:**
   - When you open a PR, GitHub Actions triggers the build workflow.
3. **Automated Build & Push:**
   - The workflow builds a multi-arch Docker image and pushes it to GHCR.
   - Verify the build status in GitHub Actions.
   - The images are named as follows: `ghcr.io/refactor-group/refactor-platform-fe/<branch>:latest`
4. **Local Testing (Optional):**
   - For local Docker testing, note that the Docker Compose file and environment variables are maintained in the backend repository. Make sure you have access to that repo for configuration details.

---

## Manual Docker Image Management

### If you plan on working with the Docker Image Locally as well the following section acts as a quickstart guide for managing the Docker images manually

#### Prerequisites

- Before running any Docker commands, ensure you are logged into GHCR using your GitHub personal access token (PAT):

```bash
docker login ghcr.io -u <your_github_username> -p <your_PAT>
```

- Ensure you have Containerd installed and running
- Ensure you have Docker Buildx installed and configured
- Ensure you are using the builder instance you create using steps 1-4 below
- Ensure you have Docker installed and running
**Image Naming Convention:**  
The Docker images follow the naming convention:  
`ghcr.io/refactor-group/refactor-platform-fe/<branch>:latest`  

Where:

- `refactor-group` is your GitHub organization.
- `refactor-platform-fe` is the repository name.  
- `<branch>` is the name of the branch, with underscores converted to dashes.
- `latest` is the tag.

**Useful Commands:**

```bash
# Docker Buildx: Enhanced Image Management

# 1. Inspect Docker Buildx
docker buildx version # Verify Docker Buildx is installed

# 2. Create a new builder instance (if needed)
docker buildx create --name mybuilder --driver docker-container # Creates a builder instance named 'mybuilder' using the docker-container driver

# 3. Use the builder
docker buildx use mybuilder # Sets 'mybuilder' as the current builder

# 4. Inspect the builder
docker buildx inspect --bootstrap # Displays details and ensures the builder is running

# 5. Login to GHCR
docker login ghcr.io -u <your_github_username> -p <your_PAT> # Authenticates with GitHub Container Registry using your username and PAT

# 6. Build the image for multiple architectures and push to registry
docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/refactor-group/refactor-platform-fe:<branch> --push . # Builds for specified architectures and pushes to GHCR

# 7. Build the image for multiple architectures and load to local docker daemon
docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/refactor-group/refactor-platform-fe:<branch> --load . # Builds for specified architectures and loads to local docker daemon

# 8. Tag the image
docker tag ghcr.io/refactor-group/refactor-platform-fe:<branch> ghcr.io/refactor-group/refactor-platform-fe:<branch>:latest # Creates an additional tag 'latest' for the image

# 9. Push the image
docker push ghcr.io/refactor-group/refactor-platform-fe:<branch>:latest # Uploads the image to the container registry

# 10. Pull the image
docker pull ghcr.io/refactor-group/refactor-platform-fe:<branch>:latest # Downloads the image from the container registry

# 11. Run the image
docker run -p 3000:3000 ghcr.io/refactor-group/refactor-platform-fe:<branch>:latest # Starts a container from the image, mapping port 3000

# 12. Inspect the image
docker inspect ghcr.io/refactor-group/refactor-platform-fe:<branch>:latest # Shows detailed information about the image

# 13. Remove the image
docker rmi ghcr.io/refactor-group/refactor-platform-fe:<branch>:latest # Deletes the image from the local machine
```

### Important Notes

- Always use the `latest` tag for the most recent version (it defaults to `latest`)
- Ensure your branch is up to date with the main branch before opening a PR
- For backend-specific configuration (Docker Compose & env vars), refer to the backend repository documentation
